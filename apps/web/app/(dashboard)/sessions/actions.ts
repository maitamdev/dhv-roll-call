'use server';

import { randomInt } from 'node:crypto';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePageRole } from '@/lib/auth';
import { canAccessAttendanceSession, canAccessCourseSection, getAccessibleCourseSectionIds } from '@/lib/authorization';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireSessionStaff() {
  return requirePageRole(['ADMIN', 'TRAINING_OFFICE', 'LECTURER']);
}

async function requireSessionAdmin() {
  return requirePageRole(['ADMIN', 'TRAINING_OFFICE']);
}

export async function fetchSessionsAdmin() {
  const actor = await requireSessionStaff();
  const allowedSections = await getAccessibleCourseSectionIds(actor);
  let query = supabaseAdmin
    .from('attendance_sessions')
    .select(`
      id, status, scheduled_start, scheduled_end, session_token, face_verification_required,
      course_sections (
        id, section_code,
        courses (course_name),
        classes (class_name)
      ),
      rooms (room_code, building)
    `);
  if (allowedSections !== null) {
    if (allowedSections.length === 0) return [];
    query = query.in('course_section_id', allowedSections);
  }
  const { data, error } = await query.order('scheduled_start', { ascending: false });
  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
  return data || [];
}

export async function fetchCourseSectionsAdmin() {
  const actor = await requireSessionStaff();
  const allowedSections = await getAccessibleCourseSectionIds(actor);
  let query = supabaseAdmin
    .from('course_sections')
    .select(`
      id, section_code, status,
      courses (course_code, course_name),
      classes (class_name),
      lecturers (full_name)
    `)
    .eq('status', 'OPEN');
  if (allowedSections !== null) {
    if (allowedSections.length === 0) return [];
    query = query.in('id', allowedSections);
  }
  const { data, error } = await query.order('section_code');
  if (error) {
    console.error('Error fetching sections:', error);
    return [];
  }
  return data || [];
}

export async function fetchRoomsAdmin() {
  await requireSessionStaff();
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, room_code, building, capacity')
    .order('building')
    .order('room_code');
  if (error) return [];
  return data || [];
}

export async function createSessionAdmin(payload: {
  course_section_id: string;
  room_id: string;
  startDateTime: string;
  endDateTime: string;
  scanDeadline: string;
  lateAfter: string;
  faceVerificationRequired: boolean;
  openImmediately: boolean;
}) {
  const actor = await requireSessionStaff();
  if (!uuidPattern.test(payload.course_section_id) || !uuidPattern.test(payload.room_id)) {
    return { success: false as const, error: 'Học phần hoặc phòng học không hợp lệ.' };
  }
  if (!(await canAccessCourseSection(actor, payload.course_section_id))) {
    return { success: false as const, error: 'Bạn không phụ trách học phần này.' };
  }

  const start = new Date(payload.startDateTime);
  const end = new Date(payload.endDateTime);
  const lateAfter = new Date(payload.lateAfter);
  const deadline = new Date(payload.scanDeadline);
  if ([start, end, lateAfter, deadline].some((date) => Number.isNaN(date.getTime()))) {
    return { success: false as const, error: 'Ngày giờ của buổi học không hợp lệ.' };
  }
  const durationMs = end.getTime() - start.getTime();
  if (durationMs < 15 * 60_000 || durationMs > 12 * 60 * 60_000) {
    return { success: false as const, error: 'Buổi học phải kéo dài từ 15 phút đến 12 giờ.' };
  }
  if (lateAfter <= start || lateAfter > deadline || deadline > end) {
    return { success: false as const, error: 'Mốc đi muộn và hạn quét phải nằm trong thời gian buổi học.' };
  }

  const { data: room } = await supabaseAdmin.from('rooms').select('id').eq('id', payload.room_id).maybeSingle();
  if (!room) return { success: false as const, error: 'Phòng học không tồn tại.' };

  const [{ data: roomConflict }, { data: sectionConflict }, { data: enrollments, error: enrollmentError }] = await Promise.all([
    supabaseAdmin
      .from('attendance_sessions')
      .select('id')
      .eq('room_id', payload.room_id)
      .in('status', ['DRAFT', 'OPEN'])
      .lt('scheduled_start', end.toISOString())
      .gt('scheduled_end', start.toISOString())
      .limit(1),
    supabaseAdmin
      .from('attendance_sessions')
      .select('id')
      .eq('course_section_id', payload.course_section_id)
      .in('status', ['DRAFT', 'OPEN'])
      .lt('scheduled_start', end.toISOString())
      .gt('scheduled_end', start.toISOString())
      .limit(1),
    supabaseAdmin
      .from('enrollments')
      .select('student_id')
      .eq('course_section_id', payload.course_section_id)
      .eq('status', 'ACTIVE'),
  ]);
  if (roomConflict?.length) return { success: false as const, error: 'Phòng đã có buổi học khác trong khung giờ này.' };
  if (sectionConflict?.length) return { success: false as const, error: 'Học phần đã có một buổi khác trùng thời gian.' };
  if (enrollmentError) return { success: false as const, error: enrollmentError.message };
  if (!enrollments?.length) {
    return { success: false as const, error: 'Học phần chưa có sinh viên. Hãy thêm sinh viên trước khi tạo buổi học.' };
  }

  let session: any = null;
  let insertError: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = randomInt(100000, 1_000_000).toString();
    const result = await supabaseAdmin
      .from('attendance_sessions')
      .insert({
        course_section_id: payload.course_section_id,
        room_id: payload.room_id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        scan_deadline: deadline.toISOString(),
        late_after: lateAfter.toISOString(),
        status: payload.openImmediately ? 'OPEN' : 'DRAFT',
        opened_at: payload.openImmediately ? new Date().toISOString() : null,
        session_token: token,
        opened_by: actor.appUserId,
        face_verification_required: payload.faceVerificationRequired,
      })
      .select()
      .single();
    session = result.data;
    insertError = result.error;
    if (!insertError || insertError.code !== '23505') break;
  }
  if (insertError || !session) {
    return { success: false as const, error: insertError?.message || 'Không thể tạo buổi học.' };
  }

  const records = enrollments.map((enrollment) => ({
    session_id: session.id,
    student_id: enrollment.student_id,
    status: 'NOT_MARKED',
    source: 'SYSTEM_GENERATED',
  }));
  const { error: recordsError } = await supabaseAdmin.from('attendance_records').insert(records);
  if (recordsError) {
    await supabaseAdmin.from('attendance_sessions').delete().eq('id', session.id);
    return { success: false as const, error: recordsError.message };
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actor.appUserId,
    action: 'ATTENDANCE_SESSION_CREATED',
    entity_type: 'ATTENDANCE_SESSION',
    entity_id: session.id,
    new_value: {
      courseSectionId: payload.course_section_id,
      roomId: payload.room_id,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
      faceVerificationRequired: payload.faceVerificationRequired,
      status: session.status,
      rosterSize: records.length,
    },
  });
  return { success: true as const, data: session };
}

export async function deleteSessionAdmin(sessionId: string) {
  const actor = await requireSessionAdmin();
  try {
    if (!uuidPattern.test(sessionId)) return { success: false as const, error: 'Mã phiên không hợp lệ.' };
    if (!(await canAccessAttendanceSession(actor, sessionId))) {
      return { success: false as const, error: 'Bạn không có quyền với phiên này.' };
    }
    const { data: session } = await supabaseAdmin.from('attendance_sessions').select('status').eq('id', sessionId).maybeSingle();
    if (!session) return { success: false as const, error: 'Không tìm thấy phiên.' };
    if (session.status === 'OPEN') return { success: false as const, error: 'Hãy đóng phiên trước khi xóa.' };
    const { error } = await supabaseAdmin.from('attendance_sessions').delete().eq('id', sessionId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Không thể xóa phiên.' };
  }
}

export async function fetchLiveSessionAdmin(sessionId: string) {
  const actor = await requireSessionStaff();
  if (!(await canAccessAttendanceSession(actor, sessionId))) {
    return { session: null, records: [], students: [] };
  }
  noStore();
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      id, status, scheduled_start, scheduled_end, late_after, scan_deadline, session_token, face_verification_required,
      course_sections (
        section_code,
        courses (course_name, course_code),
        classes (class_name),
        lecturers (full_name)
      ),
      rooms (room_code, building)
    `)
    .eq('id', sessionId)
    .single();

  const { data: records } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      id, session_id, student_id, status, first_scan_at, source,
      students (
        id, student_code, full_name, avatar_url,
        classes (class_name)
      )
    `)
    .eq('session_id', sessionId);
  return { session, records: records || [], students: [] };
}
