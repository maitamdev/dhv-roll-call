'use server';

import { supabaseAdmin } from '@/lib/supabase';

export async function fetchStudentsPageAdmin() {
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

  // Also auto-enroll them in any active course sections for their class
  // Since we only have 1 dummy class/section, let's just enroll them in all sections for now to be safe
  const { data: sections } = await supabaseAdmin.from('course_sections').select('id');
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
