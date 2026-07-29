import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const reportRoles = ['ADMIN', 'TRAINING_OFFICE'] as const;

type SummaryRow = {
  student_id: string;
  student_code: string;
  full_name: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  total_count: number;
};

export async function GET() {
  const auth = await requireApiRole([...reportRoles]);
  if (auth.response) return auth.response;

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabaseAdmin.rpc('attendance_report_summary'),
    supabaseAdmin.from('attendance_sessions').select('id', { count: 'exact', head: true }),
  ]);
  if (error || countError) {
    return NextResponse.json(
      { success: false, message: error?.message || countError?.message || 'Không thể tổng hợp báo cáo.' },
      { status: 500 },
    );
  }

  const rows = ((data || []) as SummaryRow[]).map((row) => {
    const total = Number(row.total_count) || 0;
    const present = Number(row.present_count) || 0;
    const late = Number(row.late_count) || 0;
    return {
      id: row.student_id,
      code: row.student_code,
      name: row.full_name,
      present,
      late,
      absent: Number(row.absent_count) || 0,
      percentage: total ? Math.round(((present + late) / total) * 100) : 0,
    };
  });

  return NextResponse.json(
    { success: true, rows, sessionCount: count || 0 },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
  );
}
