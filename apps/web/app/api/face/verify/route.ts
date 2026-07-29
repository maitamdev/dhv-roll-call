import { NextRequest, NextResponse } from 'next/server';
import { decodeJpegDataUrl, recognizeFace } from '@/lib/face-provider';
import { verifyScannerRequest } from '@/lib/scanner-security';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  const trust = await verifyScannerRequest(request, rawBody);
  if (trust.error || !trust.device) {
    return NextResponse.json({ success: false, code: 'DEVICE_BLOCKED', message: trust.error }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST', message: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
  const liveness = body.liveness && typeof body.liveness === 'object'
    ? body.liveness as { action?: string; passed?: boolean; durationMs?: number }
    : {};
  if (!UUID_PATTERN.test(challengeId)) {
    return NextResponse.json({ success: false, code: 'INVALID_REQUEST', message: 'Challenge không hợp lệ.' }, { status: 400 });
  }
  let image: Buffer;
  try {
    image = decodeJpegDataUrl(body.image);
  } catch {
    return NextResponse.json({ success: false, code: 'INVALID_IMAGE', message: 'Ảnh xác minh không hợp lệ.' }, { status: 400 });
  }

  const { data: challenge } = await supabaseAdmin
    .from('face_verification_challenges')
    .select('id, status, expires_at, attempts, max_attempts, liveness_action, student_id, session_id, device_id, students(id, student_code, full_name, email, status, classes(class_name), biometric_profiles(provider_subject, status))')
    .eq('id', challengeId)
    .maybeSingle();
  if (!challenge || challenge.device_id !== trust.device.id || challenge.status !== 'PENDING') {
    return NextResponse.json({ success: false, code: 'CHALLENGE_INVALID', message: 'Thử thách không còn hợp lệ.' }, { status: 409 });
  }
  if (Date.parse(challenge.expires_at) < Date.now()) {
    await supabaseAdmin.from('face_verification_challenges').update({ status: 'EXPIRED' }).eq('id', challenge.id);
    return NextResponse.json({ success: false, code: 'CHALLENGE_EXPIRED', message: 'Đã hết thời gian xác minh. Vui lòng quét lại thẻ.' }, { status: 410 });
  }

  const livenessPassed = liveness.passed === true &&
    liveness.action === challenge.liveness_action &&
    typeof liveness.durationMs === 'number' &&
    liveness.durationMs >= 350 &&
    liveness.durationMs <= 30_000;
  const challengeStudent = Array.isArray(challenge.students) ? challenge.students[0] : challenge.students;
  const biometricRaw = challengeStudent && (Array.isArray(challengeStudent.biometric_profiles)
    ? challengeStudent.biometric_profiles[0]
    : challengeStudent.biometric_profiles);
  const threshold = Math.min(0.99, Math.max(0.7, Number(process.env.FACE_MATCH_THRESHOLD || '0.88')));
  let faceMatched = false;
  let similarity = 0;
  let detectedFaces = 0;
  let providerError = false;
  if (livenessPassed && biometricRaw?.status === 'ACTIVE') {
    try {
      const result = await recognizeFace(biometricRaw.provider_subject, image, threshold);
      faceMatched = result.matched;
      similarity = result.similarity;
      detectedFaces = result.detectedFaces;
    } catch {
      providerError = true;
    }
  }

  const resultCode = providerError ? 'PROVIDER_UNAVAILABLE'
    : !livenessPassed ? 'LIVENESS_FAILED'
    : detectedFaces !== 1 ? 'FACE_COUNT_INVALID'
    : !faceMatched ? 'FACE_MISMATCH'
    : 'VERIFIED';
  const { data: attempt } = await supabaseAdmin
    .from('face_verification_attempts')
    .insert({
      challenge_id: challenge.id,
      device_id: trust.device.id,
      liveness_passed: livenessPassed,
      face_matched: faceMatched,
      similarity,
      threshold,
      result_code: resultCode,
      processing_ms: Date.now() - startedAt,
    })
    .select('id')
    .single();
  const nextAttempts = challenge.attempts + 1;

  if (resultCode !== 'VERIFIED' || !attempt) {
    const terminal = nextAttempts >= challenge.max_attempts;
    await supabaseAdmin.from('face_verification_challenges').update({
      attempts: nextAttempts,
      status: terminal ? 'FAILED' : 'PENDING',
    }).eq('id', challenge.id);
    await supabaseAdmin.from('fraud_alerts').insert({
      student_id: challenge.student_id,
      session_id: challenge.session_id,
      device_id: trust.device.id,
      verification_attempt_id: attempt?.id || null,
      alert_type: resultCode,
      severity: resultCode === 'FACE_MISMATCH' ? 'HIGH' : 'MEDIUM',
      risk_score: resultCode === 'FACE_MISMATCH' ? 85 : 60,
      details: { similarity, threshold, detectedFaces, terminal },
    });
    const status = providerError ? 503 : 401;
    return NextResponse.json({
      success: false,
      code: resultCode,
      message: providerError
        ? 'Engine khuôn mặt đang gián đoạn. Mời giảng viên xác minh thủ công.'
        : terminal ? 'Xác minh không đạt sau 3 lần. Đã chuyển giảng viên xem xét.' : 'Chưa xác minh được. Vui lòng làm lại thử thách.',
      attemptsRemaining: Math.max(0, challenge.max_attempts - nextAttempts),
    }, { status });
  }

  const verifiedAt = new Date().toISOString();
  await supabaseAdmin.from('face_verification_challenges').update({
    status: 'VERIFIED',
    attempts: nextAttempts,
    verified_at: verifiedAt,
  }).eq('id', challenge.id);
  const { data: finalized, error: finalizeError } = await supabaseAdmin
    .rpc('finalize_verified_attendance', { p_challenge_id: challenge.id, p_attempt_id: attempt.id })
    .single();
  if (finalizeError || !finalized) {
    return NextResponse.json({
      success: false,
      code: finalizeError?.message?.includes('OVERLAPPING_ATTENDANCE') ? 'OVERLAPPING_ATTENDANCE' : 'SERVER_ERROR',
      message: finalizeError?.message?.includes('OVERLAPPING_ATTENDANCE')
        ? 'Phát hiện điểm danh trùng giờ ở phiên khác. Đã chuyển cảnh báo để kiểm tra.'
        : 'Không thể hoàn tất bản ghi điểm danh.',
    }, { status: 409 });
  }
  const attendanceResult = finalized as {
    attendance_status: 'PRESENT' | 'LATE';
    recorded_at: string;
  };

  const studentRaw = Array.isArray(challenge.students) ? challenge.students[0] : challenge.students;
  const classRaw = studentRaw && (Array.isArray(studentRaw.classes) ? studentRaw.classes[0] : studentRaw.classes);
  return NextResponse.json({
    success: true,
    code: 'ATTENDANCE_RECORDED',
    message: 'Đã xác minh thẻ, liveness và khuôn mặt.',
    student: studentRaw ? {
      id: studentRaw.id,
      studentCode: studentRaw.student_code,
      fullName: studentRaw.full_name,
      className: classRaw?.class_name || '',
      email: studentRaw.email || '',
      status: studentRaw.status,
    } : undefined,
    attendance: { status: attendanceResult.attendance_status, recordedAt: attendanceResult.recorded_at },
    verification: { similarity, threshold },
  });
}
