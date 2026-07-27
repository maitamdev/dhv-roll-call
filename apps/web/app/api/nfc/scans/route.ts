import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashCardUid, normalizeCardUid } from '@/lib/crypto';
import { NFCScanRequestPayload, NFCScanResponsePayload } from '@shared/index';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body: NFCScanRequestPayload = await req.json();
    const { sessionId, cardUid, deviceId, clientScannedAt, source, requestId } = body;

    if (!sessionId || !cardUid || !requestId) {
      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'CARD_NOT_FOUND',
        message: 'Thiếu thông tin bắt buộc (sessionId, cardUid, requestId)',
      }, { status: 400 });
    }

    // 1. Idempotency Check on scan_events via requestId
    const { data: existingEvent } = await supabaseAdmin
      .from('scan_events')
      .select('id, result_code')
      .eq('request_id', requestId)
      .single();

    if (existingEvent) {
      return NextResponse.json<NFCScanResponsePayload>({
        success: true,
        code: 'ALREADY_ATTENDED',
        message: 'Lượt quẹt thẻ này đã được hệ thống ghi nhận trước đó.',
      });
    }

    // 2. Validate Session
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('attendance_sessions')
      .select(`
        id, status, late_after, scan_deadline, course_section_id,
        course_sections (
          id, section_code,
          courses (course_name)
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'SESSION_CLOSED',
        message: 'Không tìm thấy phiên điểm danh.',
      }, { status: 404 });
    }

    if (session.status !== 'OPEN') {
      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'SESSION_CLOSED',
        message: 'Phiên điểm danh hiện đang đóng hoặc đã kết thúc.',
      }, { status: 400 });
    }

    // 3. Validate Device (if Android device ID provided)
    if (deviceId && source === 'ANDROID_NFC') {
      const { data: device } = await supabaseAdmin
        .from('devices')
        .select('status')
        .eq('id', deviceId)
        .single();

      if (device && device.status === 'BLOCKED') {
        return NextResponse.json<NFCScanResponsePayload>({
          success: false,
          code: 'DEVICE_BLOCKED',
          message: 'Thiết bị quét này đã bị khóa quyền sử dụng.',
        }, { status: 403 });
      }
    }

    // 4. Hash Card UID & Lookup Card Owner
    const normalizedUid = normalizeCardUid(cardUid);
    const targetUidHash = hashCardUid(normalizedUid);

    const { data: card, error: cardErr } = await supabaseAdmin
      .from('student_cards')
      .select(`
        id, status, student_id,
        students (
          id, student_code, full_name, avatar_url, class_id,
          classes (class_name)
        )
      `)
      .eq('uid_hash', targetUidHash)
      .single();

    if (cardErr || !card || !card.students) {
      // Log failed scan event
      await supabaseAdmin.from('scan_events').insert({
        request_id: requestId,
        session_id: sessionId,
        card_uid_hash: targetUidHash,
        device_id: deviceId || null,
        client_scanned_at: clientScannedAt || new Date().toISOString(),
        result_code: 'CARD_NOT_FOUND',
        latency_ms: Date.now() - startTime,
        metadata: { source, cardUidMasked: normalizedUid.substring(0, 4) + '****' }
      });

      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'CARD_NOT_FOUND',
        message: 'Thẻ NFC chưa được đăng ký trong hệ thống!',
      }, { status: 404 });
    }

    if (card.status !== 'ACTIVE') {
      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'INVALID_CARD_STATUS',
        message: `Thẻ NFC đang ở trạng thái (${card.status}), không thể điểm danh.`,
      }, { status: 400 });
    }

    const studentData = Array.isArray(card.students) ? card.students[0] : card.students;
    const studentId = studentData.id;
    const studentClassData = Array.isArray(studentData.classes) ? studentData.classes[0] : studentData.classes;
    const studentClassName = (studentClassData as any)?.class_name || '';

    // 5. Check Enrollment in Course Section
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('course_section_id', session.course_section_id)
      .eq('student_id', studentId)
      .single();

    if (!enrollment) {
      await supabaseAdmin.from('scan_events').insert({
        request_id: requestId,
        session_id: sessionId,
        card_uid_hash: targetUidHash,
        device_id: deviceId || null,
        client_scanned_at: clientScannedAt || new Date().toISOString(),
        result_code: 'NOT_ENROLLED',
        latency_ms: Date.now() - startTime,
      });

      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'NOT_ENROLLED',
        message: `Sinh viên ${studentData.full_name} không thuộc lớp học phần này!`,
      }, { status: 400 });
    }

    // 6. Check Existing Attendance Record
    const { data: existingRecord } = await supabaseAdmin
      .from('attendance_records')
      .select('id, status, first_scan_at')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .single();

    if (existingRecord && (existingRecord.status === 'PRESENT' || existingRecord.status === 'LATE')) {
      return NextResponse.json<NFCScanResponsePayload>({
        success: false,
        code: 'ALREADY_ATTENDED',
        message: `Sinh viên ${studentData.full_name} đã điểm danh trước đó!`,
        student: {
          id: studentData.id,
          studentCode: studentData.student_code,
          fullName: studentData.full_name,
          className: studentClassName,
          email: '',
          avatarUrl: studentData.avatar_url || '',
          status: 'ACTIVE'
        },
        attendance: {
          status: existingRecord.status as any,
          recordedAt: existingRecord.first_scan_at
        }
      });
    }

    // 7. Calculate Status (PRESENT vs LATE)
    const scanTime = clientScannedAt ? new Date(clientScannedAt) : new Date();
    const lateThreshold = new Date(session.late_after);
    const finalStatus = scanTime > lateThreshold ? 'LATE' : 'PRESENT';

    // 8. Update / Insert Attendance Record
    const nowIso = scanTime.toISOString();
    if (existingRecord) {
      await supabaseAdmin
        .from('attendance_records')
        .update({
          status: finalStatus,
          first_scan_at: nowIso,
          last_scan_at: nowIso,
          device_id: deviceId || null,
          source: source,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id);
    } else {
      await supabaseAdmin
        .from('attendance_records')
        .insert({
          session_id: sessionId,
          student_id: studentId,
          status: finalStatus,
          first_scan_at: nowIso,
          last_scan_at: nowIso,
          device_id: deviceId || null,
          source: source
        });
    }

    // 9. Record Scan Event Audit
    await supabaseAdmin.from('scan_events').insert({
      request_id: requestId,
      session_id: sessionId,
      card_uid_hash: targetUidHash,
      device_id: deviceId || null,
      client_scanned_at: nowIso,
      result_code: 'ATTENDANCE_RECORDED',
      latency_ms: Date.now() - startTime,
      metadata: { finalStatus, studentCode: studentData.student_code, source }
    });

    return NextResponse.json<NFCScanResponsePayload>({
      success: true,
      code: 'ATTENDANCE_RECORDED',
      message: `Điểm danh thành công (${finalStatus === 'PRESENT' ? 'Có mặt' : 'Đi muộn'})`,
      student: {
        id: studentData.id,
        studentCode: studentData.student_code,
        fullName: studentData.full_name,
        className: studentClassName,
        email: '',
        avatarUrl: studentData.avatar_url || '',
        status: 'ACTIVE'
      },
      attendance: {
        status: finalStatus as any,
        recordedAt: nowIso
      }
    });

  } catch (err: any) {
    console.error('NFC Scan error:', err);
    return NextResponse.json<NFCScanResponsePayload>({
      success: false,
      code: 'SESSION_CLOSED',
      message: 'Lỗi hệ thống khi xử lý quẹt thẻ: ' + (err.message || ''),
    }, { status: 500 });
  }
}
