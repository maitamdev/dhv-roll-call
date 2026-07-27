'use server';

import { supabaseAdmin } from '@/lib/supabase';

export async function fetchSessionsAdmin() {
  const { data, error } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      id, status, scheduled_start, scheduled_end, session_token,
      course_sections (
        id, section_code,
        courses (course_name),
        classes (class_name)
      )
    `)
    .order('scheduled_start', { ascending: false });
  
  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
  return data || [];
}

export async function fetchCourseSectionsAdmin() {
  const { data, error } = await supabaseAdmin
    .from('course_sections')
    .select(`
      id, section_code,
      courses (course_name),
      classes (class_name)
    `);
    
  if (error) {
    console.error('Error fetching sections:', error);
    return [];
  }
  return data || [];
}

export async function createSessionAdmin(payload: {
  course_section_id: string;
  startDateTime: string;
  endDateTime: string;
  scanDeadline: string;
  lateAfter: string;
  token: string;
}) {
  const { data, error } = await supabaseAdmin.from('attendance_sessions').insert({
    course_section_id: payload.course_section_id,
    scheduled_start: payload.startDateTime,
    scheduled_end: payload.endDateTime,
    scan_deadline: payload.scanDeadline,
    late_after: payload.lateAfter,
    status: 'OPEN',
    session_token: payload.token
  }).select().single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Pre-populate attendance_records with NOT_MARKED for all enrolled students
  try {
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('course_section_id', payload.course_section_id);

    if (enrollments && enrollments.length > 0) {
      const recordsToInsert = enrollments.map(e => ({
        session_id: data.id,
        student_id: e.student_id,
        status: 'NOT_MARKED',
        source: 'SYSTEM_GENERATED'
      }));
      await supabaseAdmin.from('attendance_records').insert(recordsToInsert);
    }
  } catch (err) {
    console.error('Failed to pre-populate attendance records:', err);
  }

  return { success: true, data };
}

import { unstable_noStore as noStore } from 'next/cache';

export async function fetchLiveSessionAdmin(sessionId: string) {
  noStore();
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      id, status, scheduled_start, scheduled_end, late_after, session_token,
      course_sections (
        section_code,
        courses (course_name, course_code),
        classes (class_name),
        lecturers (full_name)
      ),
      rooms (room_code)
    `)
    .eq('id', sessionId)
    .single();

  const { data: recs } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      id, session_id, student_id, status, first_scan_at, source,
      students (
        id, student_code, full_name, avatar_url,
        classes (class_name)
      )
    `)
    .eq('session_id', sessionId);

  const { data: stList } = await supabaseAdmin
    .from('students')
    .select('id, student_code, full_name');

  return { session, records: recs || [], students: stList || [] };
}
