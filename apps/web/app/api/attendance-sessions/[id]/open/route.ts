import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const nowIso = new Date().toISOString();

    const { data: updatedSession, error } = await supabaseAdmin
      .from('attendance_sessions')
      .update({
        status: 'OPEN',
        opened_at: nowIso,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã mở phiên điểm danh thành công.',
      session: updatedSession
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
