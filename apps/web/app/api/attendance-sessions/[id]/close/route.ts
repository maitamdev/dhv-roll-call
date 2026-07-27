import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const nowIso = new Date().toISOString();

    // 1. Close the session
    const { data: updatedSession, error: sessionErr } = await supabaseAdmin
      .from('attendance_sessions')
      .update({
        status: 'CLOSED',
        closed_at: nowIso,
      })
      .eq('id', sessionId)
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

    return NextResponse.json({
      success: true,
      message: 'Đã đóng phiên điểm danh. Các sinh viên chưa quét thẻ đã được tự động đánh dấu VẮNG (ABSENT).',
      session: updatedSession
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
