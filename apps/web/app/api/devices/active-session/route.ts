import { NextRequest, NextResponse } from 'next/server';
import { verifyScannerRequest } from '@/lib/scanner-security';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const trust = await verifyScannerRequest(request, rawBody);
  if (trust.error || !trust.device) {
    return NextResponse.json({ success: false, active: false, message: trust.error || 'Máy quét không hợp lệ.' }, { status: 403 });
  }
  if (!trust.device.roomId) {
    return NextResponse.json(
      { success: false, active: false, code: 'ROOM_NOT_ASSIGNED', message: 'Máy quét chưa được Admin gán phòng.' },
      { status: 409 },
    );
  }

  const now = new Date();
  const startCeiling = new Date(now.getTime() + 5 * 60_000);
  const { data: sessions, error } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      id, session_token, scheduled_start, scheduled_end, late_after, scan_deadline, face_verification_required,
      rooms (room_code, building),
      course_sections (
        section_code,
        courses (course_code, course_name),
        classes (class_name),
        lecturers (full_name)
      )
    `)
    .eq('room_id', trust.device.roomId)
    .eq('status', 'OPEN')
    .order('scheduled_start')
    .limit(2);
  if (error) {
    return NextResponse.json({ success: false, active: false, message: error.message }, { status: 500 });
  }
  if (!sessions?.length) {
    return NextResponse.json(
      {
        success: true,
        active: false,
        code: 'NO_ACTIVE_SESSION',
        message: 'Chưa có phiên điểm danh đang mở tại phòng này.',
        retryAfterSeconds: 10,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (sessions.length > 1) {
    return NextResponse.json(
      { success: false, active: false, code: 'ROOM_SESSION_CONFLICT', message: 'Phòng có nhiều phiên đang mở. Hãy đóng phiên bị trùng trên web.' },
      { status: 409 },
    );
  }

  const session: any = sessions[0];
  const section = Array.isArray(session.course_sections) ? session.course_sections[0] : session.course_sections;
  const course = Array.isArray(section?.courses) ? section.courses[0] : section?.courses;
  const cls = Array.isArray(section?.classes) ? section.classes[0] : section?.classes;
  const lecturer = Array.isArray(section?.lecturers) ? section.lecturers[0] : section?.lecturers;
  const room = Array.isArray(session.rooms) ? session.rooms[0] : session.rooms;
  const [{ count: total }, { count: attended }] = await Promise.all([
    supabaseAdmin.from('attendance_records').select('id', { count: 'exact', head: true }).eq('session_id', session.id),
    supabaseAdmin.from('attendance_records').select('id', { count: 'exact', head: true }).eq('session_id', session.id).in('status', ['PRESENT', 'LATE']),
  ]);

  return NextResponse.json(
    {
      success: true,
      active: true,
      session: {
        id: session.id,
        token: session.session_token,
        scheduledStart: session.scheduled_start,
        scheduledEnd: session.scheduled_end,
        lateAfter: session.late_after,
        scanDeadline: session.scan_deadline,
        faceVerificationRequired: session.face_verification_required,
        roomCode: room?.room_code || '',
        building: room?.building || '',
        sectionCode: section?.section_code || '',
        courseCode: course?.course_code || '',
        courseName: course?.course_name || '',
        className: cls?.class_name || '',
        lecturerName: lecturer?.full_name || '',
        totalCount: total || 0,
        attendedCount: attended || 0,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
