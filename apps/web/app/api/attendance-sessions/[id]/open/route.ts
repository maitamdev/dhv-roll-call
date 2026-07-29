import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { canAccessAttendanceSession } from '@/lib/authorization';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const crossSite = rejectCrossSiteMutation(req);
  if (crossSite) return crossSite;
  const auth = await requireApiRole(['ADMIN', 'TRAINING_OFFICE', 'LECTURER']);
  if (auth.response) return auth.response;
  try {
    const { id: sessionId } = await params;
    if (!(await canAccessAttendanceSession(auth.profile!, sessionId))) {
      return NextResponse.json({ success: false, message: 'Không có quyền với phiên này.' }, { status: 403 });
    }
    const nowIso = new Date().toISOString();
    const { data: current } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id, status, room_id, scheduled_start, scheduled_end')
      .eq('id', sessionId)
      .maybeSingle();
    if (!current) return NextResponse.json({ success: false, message: 'Không tìm thấy phiên.' }, { status: 404 });
    if (current.status !== 'DRAFT') {
      return NextResponse.json({ success: false, message: 'Chỉ phiên bản nháp mới được mở. Phiên đã đóng là dữ liệu hoàn tất.' }, { status: 409 });
    }
    if (!current.room_id) {
      return NextResponse.json({ success: false, message: 'Phiên chưa được gán phòng học.' }, { status: 400 });
    }
    const { data: conflicts } = await supabaseAdmin
      .from('attendance_sessions')
      .select('id')
      .eq('room_id', current.room_id)
      .eq('status', 'OPEN')
      .neq('id', sessionId)
      .lt('scheduled_start', current.scheduled_end)
      .gt('scheduled_end', current.scheduled_start)
      .limit(1);
    if (conflicts?.length) {
      return NextResponse.json({ success: false, message: 'Phòng đang có phiên khác trùng thời gian.' }, { status: 409 });
    }

    const { data: updatedSession, error } = await supabaseAdmin
      .from('attendance_sessions')
      .update({
        status: 'OPEN',
        opened_at: nowIso,
      })
      .eq('id', sessionId)
      .eq('status', 'DRAFT')
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: auth.profile!.appUserId,
      action: 'ATTENDANCE_SESSION_OPENED',
      entity_type: 'ATTENDANCE_SESSION',
      entity_id: sessionId,
    });
    return NextResponse.json({
      success: true,
      message: 'Đã mở phiên điểm danh thành công.',
      session: updatedSession
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
