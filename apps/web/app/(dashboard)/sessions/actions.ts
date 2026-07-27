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

export async function createSessionAdmin(formData: {
  course_section_id: string;
  startDateTime: string;
  endDateTime: string;
  scanDeadline: string;
  lateAfter: string;
  token: string;
}) {
  const { data, error } = await supabaseAdmin.from('attendance_sessions').insert({
    course_section_id: formData.course_section_id,
    scheduled_start: formData.startDateTime,
    scheduled_end: formData.endDateTime,
    scan_deadline: formData.scanDeadline,
    late_after: formData.lateAfter,
    status: 'OPEN',
    session_token: formData.token
  }).select().single();

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, data };
}
