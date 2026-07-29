'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { requirePageRole } from '@/lib/auth';

async function requireStudentStaff() {
  return requirePageRole(['ADMIN', 'TRAINING_OFFICE']);
}

export async function fetchStudentsPageAdmin() {
  await requireStudentStaff();
  const { data, error } = await supabaseAdmin
    .from('students')
    .select(`
      id, student_code, full_name, email, phone, status, class_id,
      classes (class_name, class_code),
      student_cards (uid_masked, status)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  return data || [];
}

export async function fetchClassesAdmin() {
  await requireStudentStaff();
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id, class_name, class_code');

  if (error) return [];
  return data || [];
}

export async function addStudentAdmin(payload: {
  student_code: string;
  full_name: string;
  email: string;
  phone: string;
  class_id: string;
}) {
  await requireStudentStaff();
  if (!payload.student_code || !payload.full_name || !payload.class_id) {
    return { success: false, error: 'Vui lòng nhập đầy đủ MSSV, Tên và Lớp.' };
  }

  // Check duplicate code
  const { data: existing } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('student_code', payload.student_code)
    .single();

  if (existing) {
    return { success: false, error: 'Mã số sinh viên này đã tồn tại trong hệ thống!' };
  }

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({
      student_code: payload.student_code,
      full_name: payload.full_name,
      email: payload.email || null,
      phone: payload.phone || null,
      class_id: payload.class_id,
      status: 'ACTIVE'
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Auto-enroll only in course sections assigned to the selected class.
  const { data: sections } = await supabaseAdmin
    .from('course_sections')
    .select('id')
    .eq('class_id', payload.class_id)
    .eq('status', 'OPEN');
  if (sections && sections.length > 0) {
    for (const sec of sections) {
      await supabaseAdmin.from('enrollments').upsert({
        course_section_id: sec.id,
        student_id: data.id
      });
    }
  }

  return { success: true, data };
}
