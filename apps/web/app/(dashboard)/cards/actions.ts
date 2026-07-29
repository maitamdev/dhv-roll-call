'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { hashCardUid, normalizeCardUid } from '@/lib/crypto';
import { requirePageRole } from '@/lib/auth';

async function requireCardStaff() {
  return requirePageRole(['ADMIN', 'TRAINING_OFFICE']);
}

export async function fetchCardsAdmin() {
  await requireCardStaff();
  const { data, error } = await supabaseAdmin
    .from('student_cards')
    .select(`
      id, uid_hash, status, created_at,
      students (
        id, student_code, full_name,
        classes (class_name)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cards:', error);
    return [];
  }
  return data || [];
}

export async function fetchStudentsAdmin() {
  await requireCardStaff();
  const { data, error } = await supabaseAdmin
    .from('students')
    .select(`
      id, student_code, full_name,
      classes (class_name)
    `)
    .order('student_code', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }
  return data || [];
}

export async function registerCardAdmin(studentId: string, uidHex: string) {
  await requireCardStaff();
  if (!uidHex || !studentId) {
    return { success: false, error: 'Vui lòng nhập đủ thông tin.' };
  }

  const normalizedUid = uidHex.toUpperCase().replace(/[^A-F0-9]/g, '');
  if (normalizedUid.length < 8) {
    return { success: false, error: 'Mã UID không hợp lệ (Phải từ 8 ký tự Hex trở lên).' };
  }

  const uidHash = hashCardUid(uidHex);

  // Check if card is already registered
  const { data: existingCard } = await supabaseAdmin
    .from('student_cards')
    .select('id')
    .eq('uid_hash', uidHash)
    .single();

  if (existingCard) {
    return { success: false, error: 'Thẻ này đã được đăng ký cho một sinh viên khác!' };
  }

  const { data, error } = await supabaseAdmin.from('student_cards').upsert({
    uid_hash: uidHash,
    uid_masked: `**:**:**:${uidHex.split(':').pop() || uidHex.slice(-2)}`,
    student_id: studentId,
    status: 'ACTIVE'
  }).select().single();

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function deleteCardAdmin(cardId: string) {
  await requireCardStaff();
  const { error } = await supabaseAdmin
    .from('student_cards')
    .delete()
    .eq('id', cardId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
