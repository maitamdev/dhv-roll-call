import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('attendance_sessions')
      .select(`
        id, status, scheduled_start, scheduled_end, opened_at, closed_at, late_after, scan_deadline, session_token,
        course_sections (
          id, section_code,
          courses (course_code, course_name, credits),
          classes (class_code, class_name),
          lecturers (full_name)
        ),
        rooms (room_code, building)
      `)
      .order('scheduled_start', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Format for client consumption
    const formatted = (sessions || []).map((s: any) => {
      const section = Array.isArray(s.course_sections) ? s.course_sections[0] : s.course_sections;
      const course = Array.isArray(section?.courses) ? section.courses[0] : section?.courses;
      const cls = Array.isArray(section?.classes) ? section.classes[0] : section?.classes;
      const lecturer = Array.isArray(section?.lecturers) ? section.lecturers[0] : section?.lecturers;
      const room = Array.isArray(s.rooms) ? s.rooms[0] : s.rooms;

      return {
        id: s.id,
        status: s.status,
        scheduledStart: s.scheduled_start,
        scheduledEnd: s.scheduled_end,
        lateAfter: s.late_after,
        courseCode: course?.course_code || '',
        courseName: course?.course_name || '',
        sectionCode: section?.section_code || '',
        className: cls?.class_name || cls?.class_code || '',
        lecturerName: lecturer?.full_name || '',
        roomCode: room?.room_code || '',
        building: room?.building || '',
        sessionToken: s.session_token || ''
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
