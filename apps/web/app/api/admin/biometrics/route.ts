import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { decodeJpegDataUrl, deleteFaceSubject, enrollFace } from '@/lib/face-provider';
import { supabaseAdmin } from '@/lib/supabase';

const staffRoles = ['ADMIN', 'TRAINING_OFFICE'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;

  const [{ data: students, error: studentsError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id, student_code, full_name, avatar_url, status, classes(class_name)')
      .eq('status', 'ACTIVE')
      .order('student_code'),
    supabaseAdmin
      .from('biometric_profiles')
      .select('student_id, status, sample_count, consented_at, enrolled_at, last_verified_at'),
  ]);
  if (studentsError || profilesError) {
    return NextResponse.json({ success: false, message: studentsError?.message || profilesError?.message }, { status: 500 });
  }
  const byStudent = new Map((profiles || []).map((profile) => [profile.student_id, profile]));
  return NextResponse.json({
    success: true,
    students: (students || []).map((student) => ({ ...student, biometric: byStudent.get(student.id) || null })),
  });
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  const consent = body.consent === true;
  if (!UUID_PATTERN.test(studentId) || !consent) {
    return NextResponse.json({ success: false, message: 'Cần chọn sinh viên và xác nhận đồng ý xử lý sinh trắc học.' }, { status: 400 });
  }

  let image: Buffer;
  try {
    image = decodeJpegDataUrl(body.image);
  } catch {
    return NextResponse.json({ success: false, message: 'Ảnh JPEG không hợp lệ hoặc vượt quá 2 MB.' }, { status: 400 });
  }

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!student) return NextResponse.json({ success: false, message: 'Không tìm thấy sinh viên.' }, { status: 404 });

  let { data: profile } = await supabaseAdmin
    .from('biometric_profiles')
    .select('id, provider_subject, sample_count')
    .eq('student_id', studentId)
    .maybeSingle();

  if (!profile) {
    const created = await supabaseAdmin
      .from('biometric_profiles')
      .insert({ student_id: studentId, status: 'NOT_ENROLLED' })
      .select('id, provider_subject, sample_count')
      .single();
    if (created.error || !created.data) {
      return NextResponse.json({ success: false, message: 'Không thể tạo hồ sơ sinh trắc học.' }, { status: 500 });
    }
    profile = created.data;
  }

  try {
    await enrollFace(profile.provider_subject, image);
  } catch (error) {
    const message = error instanceof Error && error.message === 'FACE_PROVIDER_NOT_CONFIGURED'
      ? 'Chưa cấu hình máy chủ CompreFace.'
      : 'Engine khuôn mặt từ chối ảnh. Hãy bảo đảm chỉ có một khuôn mặt, đủ sáng và nhìn thẳng.';
    return NextResponse.json({ success: false, message }, { status: 503 });
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('biometric_profiles')
    .update({
      status: 'ACTIVE',
      sample_count: (profile.sample_count || 0) + 1,
      consent_version: 'DHV-BIOMETRIC-2026-01',
      consented_at: now,
      enrolled_by: auth.profile!.appUserId,
      enrolled_at: now,
      revoked_at: null,
      updated_at: now,
    })
    .eq('id', profile.id);
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'BIOMETRIC_SAMPLE_ENROLLED',
    entity_type: 'STUDENT',
    entity_id: studentId,
    new_value: { consentVersion: 'DHV-BIOMETRIC-2026-01', rawImageStored: false },
  });
  return NextResponse.json({ success: true, message: 'Đã đăng ký mẫu khuôn mặt. Ảnh truyền lên không được lưu trong Supabase.' });
}

export async function DELETE(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const studentId = request.nextUrl.searchParams.get('studentId') || '';
  if (!UUID_PATTERN.test(studentId)) {
    return NextResponse.json({ success: false, message: 'Sinh viên không hợp lệ.' }, { status: 400 });
  }
  const { data: profile } = await supabaseAdmin
    .from('biometric_profiles')
    .select('provider_subject')
    .eq('student_id', studentId)
    .maybeSingle();
  if (profile) {
    try {
      await deleteFaceSubject(profile.provider_subject);
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Không xóa được mẫu khỏi engine khuôn mặt. Hồ sơ chưa bị đánh dấu đã xóa để tránh mất dấu dữ liệu.',
      }, { status: 503 });
    }
  }
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('biometric_profiles')
    .update({ status: 'REVOKED', revoked_at: now, updated_at: now })
    .eq('student_id', studentId);
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'BIOMETRIC_PROFILE_REVOKED',
    entity_type: 'STUDENT',
    entity_id: studentId,
  });
  return NextResponse.json({
    success: true,
    message: 'Đã xóa mẫu khỏi engine khuôn mặt và vô hiệu hóa hồ sơ.',
  });
}
