import { NextRequest, NextResponse } from 'next/server';
import { canAccessAttendanceSession } from '@/lib/authorization';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const allowedStatuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole(['ADMIN', 'TRAINING_OFFICE', 'LECTURER']);
  if (auth.response) return auth.response;
  const { id: sessionId } = await params;
  if (!(await canAccessAttendanceSession(auth.profile!, sessionId))) {
    return NextResponse.json({ success: false, message: 'Không có quyền với phiên này.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === 'string' ? body.studentId : '';
  const status = typeof body.status === 'string' && allowedStatuses.includes(body.status) ? body.status : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!studentId || !status || reason.length < 5) {
    return NextResponse.json({ success: false, message: 'Trạng thái hoặc lý do xác minh không hợp lệ.' }, { status: 400 });
  }

  const { data: record } = await supabaseAdmin
    .from('attendance_records')
    .select('id, status, manual_override, override_reason')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (!record) return NextResponse.json({ success: false, message: 'Không tìm thấy bản ghi điểm danh.' }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('attendance_records').update({
    status,
    first_scan_at: ['PRESENT', 'LATE'].includes(status) ? now : null,
    last_scan_at: now,
    source: 'MANUAL_OVERRIDE',
    manual_override: true,
    override_reason: reason,
    updated_by: auth.profile!.appUserId,
    updated_at: now,
  }).eq('id', record.id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'ATTENDANCE_MANUAL_OVERRIDE',
    entity_type: 'ATTENDANCE_RECORD',
    entity_id: record.id,
    old_value: record,
    new_value: { status, reason },
  });
  return NextResponse.json({ success: true });
}
