import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { NFCScanRequestPayload, NFCScanResponsePayload } from '@shared/index';
import { getAuthProfile } from '@/lib/auth';
import { hashCardUid, normalizeCardUid } from '@/lib/crypto';
import { verifyScannerRequest } from '@/lib/scanner-security';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIVENESS_ACTIONS = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT'] as const;

function response(body: NFCScanResponsePayload, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  let body: NFCScanRequestPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return response({ success: false, code: 'INVALID_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' }, 400);
  }

  let trustedDevice: { id: string; deviceUuid: string; roomId: string | null } | null = null;
  if (body.source === 'ANDROID_NFC') {
    const trust = await verifyScannerRequest(request, rawBody);
    if (trust.error || !trust.device) {
      return response({ success: false, code: 'DEVICE_BLOCKED', message: trust.error || 'Máy quét không được tin cậy.' }, 403);
    }
    trustedDevice = trust.device;
  } else {
    const simulatorEnabled = process.env.NODE_ENV !== 'production' && process.env.ALLOW_WEB_SCANNER === 'true';
    const profile = await getAuthProfile();
    if (!simulatorEnabled || !profile || !['ADMIN', 'TRAINING_OFFICE'].includes(profile.role)) {
      return response({ success: false, code: 'DEVICE_BLOCKED', message: 'Trình mô phỏng quét đã bị tắt.' }, 403);
    }
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.replace(/^#/, '') : '';
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const normalizedUid = normalizeCardUid(body.cardUid || '');
  if (!sessionId || !UUID_PATTERN.test(requestId) || normalizedUid.length < 8) {
    return response({ success: false, code: 'INVALID_REQUEST', message: 'Thiếu mã phiên, UID hoặc requestId hợp lệ.' }, 400);
  }

  const { data: previousChallenge } = await supabaseAdmin
    .from('face_verification_challenges')
    .select('id, status, expires_at, liveness_action, challenge_type, students(student_code, full_name, avatar_url, classes(class_name))')
    .eq('scan_request_id', requestId)
    .maybeSingle();
  if (previousChallenge) {
    if (previousChallenge.status === 'PENDING' && Date.parse(previousChallenge.expires_at) > Date.now()) {
      return response({
        success: true,
        code: 'FACE_VERIFICATION_REQUIRED',
        message: 'Tiếp tục xác minh khuôn mặt.',
        verification: {
          challengeId: previousChallenge.id,
          livenessAction: previousChallenge.liveness_action,
          expiresAt: previousChallenge.expires_at,
        },
      });
    }
    return response({ success: false, code: 'ALREADY_ATTENDED', message: 'Yêu cầu quét này đã được xử lý.' }, 409);
  }

  const isSessionUuid = UUID_PATTERN.test(sessionId);
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('id, status, scheduled_start, scheduled_end, late_after, scan_deadline, course_section_id, room_id, face_verification_required, random_rescan_required, random_rescan_at')
    .eq(isSessionUuid ? 'id' : 'session_token', sessionId)
    .maybeSingle();
  const now = new Date();
  if (
    !session ||
    session.status !== 'OPEN' ||
    now < new Date(new Date(session.scheduled_start).getTime() - 5 * 60_000) ||
    now > new Date(session.scan_deadline)
  ) {
    return response({ success: false, code: 'SESSION_CLOSED', message: 'Phiên không mở hoặc đã ngoài thời gian điểm danh.' }, 400);
  }
  if (trustedDevice?.roomId && session.room_id && trustedDevice.roomId !== session.room_id) {
    return response({ success: false, code: 'WRONG_ROOM', message: 'Máy quét không thuộc phòng của phiên học này.' }, 403);
  }

  const cardUidHash = hashCardUid(normalizedUid);
  const { data: card } = await supabaseAdmin
    .from('student_cards')
    .select('status, student_id, students(id, student_code, full_name, email, avatar_url, status, classes(class_name))')
    .eq('uid_hash', cardUidHash)
    .maybeSingle();
  const student = card && (Array.isArray(card.students) ? card.students[0] : card.students);
  if (!card || !student) {
    await supabaseAdmin.from('scan_events').insert({
      request_id: requestId,
      session_id: session.id,
      card_uid_hash: cardUidHash,
      device_id: trustedDevice?.id || null,
      client_scanned_at: now.toISOString(),
      result_code: 'CARD_NOT_FOUND',
      latency_ms: Date.now() - startedAt,
      risk_score: 40,
      metadata: { source: body.source },
    });
    return response({ success: false, code: 'CARD_NOT_FOUND', message: 'Thẻ chưa được đăng ký.' }, 404);
  }
  if (card.status !== 'ACTIVE' || student.status !== 'ACTIVE') {
    return response({ success: false, code: 'INVALID_CARD_STATUS', message: 'Thẻ hoặc hồ sơ sinh viên không hoạt động.' }, 403);
  }

  const { data: enrollment } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('course_section_id', session.course_section_id)
    .eq('student_id', student.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!enrollment) {
    return response({ success: false, code: 'NOT_ENROLLED', message: 'Sinh viên không thuộc lớp học phần này.' }, 403);
  }

  const studentClass = Array.isArray(student.classes) ? student.classes[0] : student.classes;
  const studentPayload = {
    id: student.id,
    studentCode: student.student_code,
    fullName: student.full_name,
    className: studentClass?.class_name || '',
    email: student.email || '',
    avatarUrl: student.avatar_url || '',
    status: student.status,
  };

  const { data: existingRecord } = await supabaseAdmin
    .from('attendance_records')
    .select('status, first_scan_at, rescan_verified_at')
    .eq('session_id', session.id)
    .eq('student_id', student.id)
    .in('status', ['PRESENT', 'LATE'])
    .maybeSingle();
  const needsRandomRescan = !!existingRecord &&
    session.random_rescan_required &&
    !!session.random_rescan_at &&
    new Date(session.random_rescan_at) <= now &&
    !existingRecord.rescan_verified_at;
  if (existingRecord && !needsRandomRescan) {
    return response({
      success: false,
      code: 'ALREADY_ATTENDED',
      message: 'Sinh viên đã điểm danh trước đó.',
      student: studentPayload,
      attendance: { status: existingRecord.status, recordedAt: existingRecord.first_scan_at },
    });
  }

  if (!session.face_verification_required) {
    const finalStatus = now > new Date(session.late_after) ? 'LATE' : 'PRESENT';
    const { error } = await supabaseAdmin.from('attendance_records').upsert({
      session_id: session.id,
      student_id: student.id,
      status: finalStatus,
      first_scan_at: now.toISOString(),
      last_scan_at: now.toISOString(),
      device_id: trustedDevice?.id || null,
      source: body.source,
      verification_method: 'NFC_ONLY',
      updated_at: now.toISOString(),
    }, { onConflict: 'session_id,student_id' });
    if (error) return response({ success: false, code: 'SERVER_ERROR', message: 'Không thể ghi điểm danh.' }, 500);
    await supabaseAdmin.from('scan_events').insert({
      request_id: requestId, session_id: session.id, card_uid_hash: cardUidHash,
      device_id: trustedDevice?.id || null, client_scanned_at: now.toISOString(),
      result_code: 'ATTENDANCE_RECORDED', latency_ms: Date.now() - startedAt,
      metadata: { verificationMethod: 'NFC_ONLY' },
    });
    return response({
      success: true,
      code: 'ATTENDANCE_RECORDED',
      message: 'Đã ghi nhận điểm danh bằng thẻ.',
      student: studentPayload,
      attendance: { status: finalStatus, recordedAt: now.toISOString() },
    });
  }

  if (!trustedDevice) {
    return response({ success: false, code: 'DEVICE_BLOCKED', message: 'Xác minh khuôn mặt chỉ chạy trên máy quét cố định.' }, 403);
  }
  const { data: biometric } = await supabaseAdmin
    .from('biometric_profiles')
    .select('status')
    .eq('student_id', student.id)
    .maybeSingle();
  if (!biometric || biometric.status !== 'ACTIVE') {
    await supabaseAdmin.from('fraud_alerts').insert({
      student_id: student.id,
      session_id: session.id,
      device_id: trustedDevice.id,
      alert_type: 'FACE_PROFILE_MISSING',
      severity: 'MEDIUM',
      risk_score: 50,
      details: { requestId },
    });
    return response({
      success: false,
      code: 'FACE_NOT_ENROLLED',
      message: 'Sinh viên chưa có hồ sơ khuôn mặt. Mời giảng viên xác minh thủ công.',
      student: studentPayload,
    }, 409);
  }

  const livenessAction = LIVENESS_ACTIONS[randomInt(LIVENESS_ACTIONS.length)];
  const expiresAt = new Date(Date.now() + 45_000).toISOString();
  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('face_verification_challenges')
    .insert({
      scan_request_id: requestId,
      session_id: session.id,
      student_id: student.id,
      device_id: trustedDevice.id,
      card_uid_hash: cardUidHash,
      liveness_action: livenessAction,
      challenge_type: needsRandomRescan ? 'RANDOM_RESCAN' : 'INITIAL',
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (challengeError || !challenge) {
    return response({ success: false, code: 'SERVER_ERROR', message: 'Không thể tạo thử thách khuôn mặt.' }, 500);
  }
  await supabaseAdmin.from('scan_events').insert({
    request_id: requestId,
    session_id: session.id,
    card_uid_hash: cardUidHash,
    device_id: trustedDevice.id,
    client_scanned_at: now.toISOString(),
    result_code: 'FACE_VERIFICATION_REQUIRED',
    latency_ms: Date.now() - startedAt,
    metadata: { livenessAction, challengeType: needsRandomRescan ? 'RANDOM_RESCAN' : 'INITIAL' },
  });
  return response({
    success: true,
    code: 'FACE_VERIFICATION_REQUIRED',
    message: 'Thẻ hợp lệ. Hãy hoàn thành xác minh khuôn mặt.',
    student: studentPayload,
    verification: { challengeId: challenge.id, livenessAction, expiresAt },
  });
}
