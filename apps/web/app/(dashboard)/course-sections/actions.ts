'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole, type AuthProfile } from '@/lib/auth';
import { canAccessCourseSection, getAccessibleCourseSectionIds } from '@/lib/authorization';
import { supabaseAdmin } from '@/lib/supabase';

// Supabase's existing data includes legacy UUID-shaped IDs whose version and
// variant nibbles are not RFC-4122 compliant. Validate the canonical shape
// without rejecting those valid database identifiers.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireSectionStaff() {
  return requirePageRole(['ADMIN', 'TRAINING_OFFICE', 'LECTURER']);
}

async function requireAcademicAdmin() {
  return requirePageRole(['ADMIN', 'TRAINING_OFFICE']);
}

async function getLecturerId(actor: AuthProfile) {
  if (actor.role !== 'LECTURER') return null;
  const { data } = await supabaseAdmin
    .from('lecturers')
    .select('id')
    .eq('user_id', actor.appUserId)
    .maybeSingle();
  return data?.id || null;
}

export async function fetchCourseSectionWorkspace() {
  const actor = await requireSectionStaff();
  const allowedSectionIds = await getAccessibleCourseSectionIds(actor);

  let sectionsQuery = supabaseAdmin
    .from('course_sections')
    .select(`
      id, section_code, status, created_at, course_id, semester_id, lecturer_id, class_id,
      courses (course_code, course_name, credits),
      semesters (semester_code, semester_name),
      lecturers (id, lecturer_code, full_name),
      classes (class_code, class_name),
      enrollments (
        id, status, student_id,
        students (id, student_code, full_name, email, status, classes (class_name))
      )
    `)
    .order('created_at', { ascending: false });

  if (allowedSectionIds !== null) {
    if (allowedSectionIds.length === 0) {
      sectionsQuery = sectionsQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      sectionsQuery = sectionsQuery.in('id', allowedSectionIds);
    }
  }

  const lecturerId = await getLecturerId(actor);
  const [sections, courses, semesters, lecturers, classes, students] = await Promise.all([
    sectionsQuery,
    supabaseAdmin.from('courses').select('id, course_code, course_name, credits').order('course_code'),
    supabaseAdmin.from('semesters').select('id, semester_code, semester_name, status').order('start_date', { ascending: false }),
    actor.role === 'LECTURER'
      ? supabaseAdmin.from('lecturers').select('id, lecturer_code, full_name').eq('id', lecturerId || '00000000-0000-0000-0000-000000000000')
      : supabaseAdmin.from('lecturers').select('id, lecturer_code, full_name').order('lecturer_code'),
    supabaseAdmin.from('classes').select('id, class_code, class_name').order('class_code'),
    actor.role === 'LECTURER'
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('students').select('id, student_code, full_name, email, class_id, status, classes(class_name)').eq('status', 'ACTIVE').order('student_code'),
  ]);

  const firstError = [sections.error, courses.error, semesters.error, lecturers.error, classes.error, students.error].find(Boolean);
  if (firstError) {
    return {
      success: false as const,
      error: firstError.message,
      data: { sections: [], courses: [], semesters: [], lecturers: [], classes: [], students: [] },
      actorRole: actor.role,
    };
  }

  return {
    success: true as const,
    error: '',
    data: {
      sections: sections.data || [],
      courses: courses.data || [],
      semesters: semesters.data || [],
      lecturers: lecturers.data || [],
      classes: classes.data || [],
      students: students.data || [],
    },
    actorRole: actor.role,
  };
}

export async function createCourseSectionAdmin(payload: {
  sectionCode: string;
  courseCode: string;
  courseName: string;
  credits: number;
  semesterId: string;
  lecturerId: string;
  classId: string;
}) {
  const actor = await requireAcademicAdmin();
  const sectionCode = payload.sectionCode.trim().toUpperCase().replace(/\s+/g, '-');
  const courseCode = payload.courseCode.trim().toUpperCase().replace(/\s+/g, '-');
  const courseName = payload.courseName.trim().slice(0, 160);
  const credits = Number(payload.credits);
  if (!/^[A-Z0-9_-]{2,30}$/.test(sectionCode)) {
    return { success: false as const, error: 'Mã lớp học phần chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.' };
  }
  if (!/^[A-Z0-9_-]{2,30}$/.test(courseCode) || courseName.length < 3) {
    return { success: false as const, error: 'Hãy nhập mã môn và tên môn học hợp lệ.' };
  }
  if (!Number.isInteger(credits) || credits < 1 || credits > 10) {
    return { success: false as const, error: 'Số tín chỉ phải là số nguyên từ 1 đến 10.' };
  }
  if (![payload.semesterId, payload.classId].every((id) => uuidPattern.test(id))) {
    return { success: false as const, error: 'Thông tin học kỳ hoặc lớp hành chính không hợp lệ.' };
  }

  let lecturerId = payload.lecturerId;
  if (actor.role === 'LECTURER') {
    lecturerId = (await getLecturerId(actor)) || '';
  }
  if (!uuidPattern.test(lecturerId)) {
    return { success: false as const, error: 'Chưa chọn giảng viên phụ trách.' };
  }

  let courseId = '';
  let createdCourse = false;
  const { data: existingCourse, error: existingCourseError } = await supabaseAdmin
    .from('courses')
    .select('id, course_name, credits')
    .eq('course_code', courseCode)
    .maybeSingle();
  if (existingCourseError) return { success: false as const, error: existingCourseError.message };
  if (existingCourse) {
    if (existingCourse.course_name.trim().toLocaleLowerCase('vi') !== courseName.toLocaleLowerCase('vi')) {
      return { success: false as const, error: `Mã môn ${courseCode} đã tồn tại với tên “${existingCourse.course_name}”.` };
    }
    courseId = existingCourse.id;
  } else {
    const { data: created, error: courseError } = await supabaseAdmin
      .from('courses')
      .insert({ course_code: courseCode, course_name: courseName, credits })
      .select('id')
      .single();
    if (courseError || !created) {
      return { success: false as const, error: courseError?.message || 'Không thể tạo môn học.' };
    }
    courseId = created.id;
    createdCourse = true;
  }

  const { data, error } = await supabaseAdmin
    .from('course_sections')
    .insert({
      section_code: sectionCode,
      course_id: courseId,
      semester_id: payload.semesterId,
      lecturer_id: lecturerId,
      class_id: payload.classId,
      status: 'OPEN',
    })
    .select('id')
    .single();
  if (error) {
    if (createdCourse) await supabaseAdmin.from('courses').delete().eq('id', courseId);
    return {
      success: false as const,
      error: error.code === '23505' ? 'Mã lớp học phần đã tồn tại.' : error.message,
    };
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actor.appUserId,
    action: 'COURSE_SECTION_CREATED',
    entity_type: 'COURSE_SECTION',
    entity_id: data.id,
    new_value: { sectionCode, courseCode, courseName, credits, courseId, semesterId: payload.semesterId, lecturerId, classId: payload.classId },
  });
  revalidatePath('/course-sections');
  revalidatePath('/sessions');
  return { success: true as const, id: data.id };
}

export async function addStudentsToCourseSectionAdmin(sectionId: string, studentIds: string[]) {
  const actor = await requireAcademicAdmin();
  if (!uuidPattern.test(sectionId) || !(await canAccessCourseSection(actor, sectionId))) {
    return { success: false as const, error: 'Bạn không có quyền cập nhật lớp học phần này.' };
  }
  const uniqueIds = [...new Set(studentIds)].filter((id) => uuidPattern.test(id)).slice(0, 500);
  if (!uniqueIds.length) {
    return { success: false as const, error: 'Hãy chọn ít nhất một sinh viên.' };
  }

  const { data: activeStudents, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .in('id', uniqueIds)
    .eq('status', 'ACTIVE');
  if (studentError) return { success: false as const, error: studentError.message };
  const activeIds = (activeStudents || []).map((student) => student.id);
  if (!activeIds.length) return { success: false as const, error: 'Không tìm thấy sinh viên đang hoạt động.' };

  const { error } = await supabaseAdmin
    .from('enrollments')
    .upsert(
      activeIds.map((studentId) => ({ course_section_id: sectionId, student_id: studentId, status: 'ACTIVE' })),
      { onConflict: 'course_section_id,student_id' },
    );
  if (error) return { success: false as const, error: error.message };

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actor.appUserId,
    action: 'COURSE_SECTION_STUDENTS_ADDED',
    entity_type: 'COURSE_SECTION',
    entity_id: sectionId,
    new_value: { studentIds: activeIds, count: activeIds.length },
  });
  revalidatePath('/course-sections');
  return { success: true as const, count: activeIds.length };
}

export async function removeStudentFromCourseSectionAdmin(sectionId: string, studentId: string) {
  const actor = await requireAcademicAdmin();
  if (!uuidPattern.test(sectionId) || !uuidPattern.test(studentId) || !(await canAccessCourseSection(actor, sectionId))) {
    return { success: false as const, error: 'Bạn không có quyền cập nhật lớp học phần này.' };
  }

  const { error } = await supabaseAdmin
    .from('enrollments')
    .delete()
    .eq('course_section_id', sectionId)
    .eq('student_id', studentId);
  if (error) return { success: false as const, error: error.message };

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actor.appUserId,
    action: 'COURSE_SECTION_STUDENT_REMOVED',
    entity_type: 'COURSE_SECTION',
    entity_id: sectionId,
    old_value: { studentId },
  });
  revalidatePath('/course-sections');
  return { success: true as const };
}

export async function assignLecturerToCourseSection(sectionId: string, lecturerId: string) {
  const actor = await requireAcademicAdmin();
  if (!uuidPattern.test(sectionId) || !uuidPattern.test(lecturerId)) {
    return { success: false as const, error: 'Mã học phần hoặc giảng viên không hợp lệ.' };
  }

  const [{ data: section }, { data: lecturer }] = await Promise.all([
    supabaseAdmin.from('course_sections').select('id, lecturer_id, section_code').eq('id', sectionId).maybeSingle(),
    supabaseAdmin.from('lecturers').select('id, full_name').eq('id', lecturerId).maybeSingle(),
  ]);
  if (!section) return { success: false as const, error: 'Không tìm thấy học phần.' };
  if (!lecturer) return { success: false as const, error: 'Không tìm thấy giảng viên.' };

  const { error } = await supabaseAdmin
    .from('course_sections')
    .update({ lecturer_id: lecturerId })
    .eq('id', sectionId);
  if (error) return { success: false as const, error: error.message };

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: actor.appUserId,
    action: 'COURSE_SECTION_LECTURER_ASSIGNED',
    entity_type: 'COURSE_SECTION',
    entity_id: sectionId,
    old_value: { lecturerId: section.lecturer_id },
    new_value: { lecturerId, lecturerName: lecturer.full_name },
  });
  revalidatePath('/course-sections');
  revalidatePath('/sessions');
  return { success: true as const };
}
