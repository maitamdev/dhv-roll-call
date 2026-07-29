import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  const auth = await requireApiRole(['STUDENT']);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const attendanceRecordId = typeof body.attendanceRecordId === 'string' ? body.attendanceRecordId : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1_000) : '';
  if (!uuidPattern.test(attendanceRecordId) || reason.length < 10) {
    return NextResponse.json(
      { success: false, message: 'Hãy chọn một buổi học và nhập lý do tối thiểu 10 ký tự.' },
      { status: 400 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('user_id', auth.profile!.appUserId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (studentError || !student) {
    return NextResponse.json({ success: false, message: 'Không tìm thấy hồ sơ sinh viên đang hoạt động.' }, { status: 404 });
  }

  const { data: record } = await supabaseAdmin
    .from('attendance_records')
    .select('id, status')
    .eq('id', attendanceRecordId)
    .eq('student_id', student.id)
    .maybeSingle();
  if (!record) {
    return NextResponse.json({ success: false, message: 'Bản ghi điểm danh không thuộc tài khoản này.' }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from('attendance_adjustment_requests')
    .select('id')
    .eq('attendance_record_id', attendanceRecordId)
    .eq('student_id', student.id)
    .eq('status', 'PENDING')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ success: false, message: 'Buổi học này đã có một yêu cầu đang chờ xử lý.' }, { status: 409 });
  }

  const { data: created, error } = await supabaseAdmin
    .from('attendance_adjustment_requests')
    .insert({
      attendance_record_id: attendanceRecordId,
      student_id: student.id,
      reason,
      status: 'PENDING',
    })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'ATTENDANCE_ADJUSTMENT_REQUESTED',
    entity_type: 'ATTENDANCE_ADJUSTMENT_REQUEST',
    entity_id: created.id,
    new_value: { attendanceRecordId, previousStatus: record.status },
  });

  return NextResponse.json({ success: true, requestId: created.id }, { status: 201 });
}
