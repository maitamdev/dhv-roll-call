import type { AuthProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function getAccessibleCourseSectionIds(profile: AuthProfile): Promise<string[] | null> {
  if (profile.role === 'ADMIN' || profile.role === 'TRAINING_OFFICE') return null;
  if (profile.role !== 'LECTURER') return [];
  const { data: lecturer } = await supabaseAdmin
    .from('lecturers')
    .select('id')
    .eq('user_id', profile.appUserId)
    .maybeSingle();
  if (!lecturer) return [];
  const { data: sections } = await supabaseAdmin
    .from('course_sections')
    .select('id')
    .eq('lecturer_id', lecturer.id);
  return (sections || []).map((section) => section.id);
}

export async function canAccessCourseSection(profile: AuthProfile, sectionId: string) {
  const ids = await getAccessibleCourseSectionIds(profile);
  return ids === null || ids.includes(sectionId);
}

export async function canAccessAttendanceSession(profile: AuthProfile, sessionId: string) {
  if (profile.role === 'ADMIN' || profile.role === 'TRAINING_OFFICE') return true;
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('course_section_id')
    .eq('id', sessionId)
    .maybeSingle();
  return !!session && canAccessCourseSection(profile, session.course_section_id);
}
