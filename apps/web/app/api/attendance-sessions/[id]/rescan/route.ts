import { NextRequest, NextResponse } from 'next/server';
import { canAccessAttendanceSession } from '@/lib/authorization';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole(['ADMIN', 'TRAINING_OFFICE', 'LECTURER']);
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!(await canAccessAttendanceSession(auth.profile!, id))) {
    return NextResponse.json({ success: false, message: 'Không có quyền với phiên này.' }, { status: 403 });
  }
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('attendance_sessions')
    .update({ random_rescan_required: true, random_rescan_at: now })
    .eq('id', id)
    .eq('status', 'OPEN');
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'RANDOM_RESCAN_STARTED',
    entity_type: 'ATTENDANCE_SESSION',
    entity_id: id,
  });
  return NextResponse.json({ success: true, message: 'Đã bắt đầu đợt tái xác minh ngẫu nhiên.' });
}
