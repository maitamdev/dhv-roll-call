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

    // 1. Close the session
    const { data: updatedSession, error: sessionErr } = await supabaseAdmin
      .from('attendance_sessions')
      .update({
        status: 'CLOSED',
        closed_at: nowIso,
      })
      .eq('id', sessionId)
      .eq('status', 'OPEN')
      .select()
      .single();

    if (sessionErr) {
      return NextResponse.json({ success: false, message: sessionErr.message }, { status: 500 });
    }

    // 2. Automatically mark all remaining NOT_MARKED students as ABSENT
    await supabaseAdmin
      .from('attendance_records')
      .update({
        status: 'ABSENT',
        updated_at: nowIso
      })
      .eq('session_id', sessionId)
      .eq('status', 'NOT_MARKED');

    let missedRescanCount = 0;
    if (updatedSession.random_rescan_required) {
      const { data: missed } = await supabaseAdmin
        .from('attendance_records')
        .select('id, student_id, device_id')
        .eq('session_id', sessionId)
        .in('status', ['PRESENT', 'LATE'])
        .is('rescan_verified_at', null);
      missedRescanCount = missed?.length || 0;
      if (missedRescanCount > 0) {
        await supabaseAdmin.from('fraud_alerts').insert((missed || []).map((record) => ({
          student_id: record.student_id,
          session_id: sessionId,
          device_id: record.device_id,
          alert_type: 'MISSED_RANDOM_RESCAN',
          severity: 'HIGH',
          risk_score: 80,
          details: { attendanceRecordId: record.id },
        })));
        await supabaseAdmin
          .from('attendance_records')
          .update({ risk_score: 80, updated_at: nowIso })
          .eq('session_id', sessionId)
          .in('status', ['PRESENT', 'LATE'])
          .is('rescan_verified_at', null);
      }
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: auth.profile!.appUserId,
      action: 'ATTENDANCE_SESSION_CLOSED',
      entity_type: 'ATTENDANCE_SESSION',
      entity_id: sessionId,
      new_value: { missedRescanCount },
    });
    return NextResponse.json({
      success: true,
      message: `Đã đóng phiên. Sinh viên chưa quét được đánh dấu vắng${missedRescanCount ? `; ${missedRescanCount} trường hợp bỏ lỡ tái xác minh đã chuyển kiểm tra` : ''}.`,
      session: updatedSession
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
