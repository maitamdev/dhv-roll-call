import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const allowedRoles = ['ADMIN', 'TRAINING_OFFICE'] as const;

export async function GET() {
  const auth = await requireApiRole([...allowedRoles]);
  if (auth.response) return auth.response;
  const [{ data: alerts }, { count: activeProfiles }, { count: recentFailures }] = await Promise.all([
    supabaseAdmin
      .from('fraud_alerts')
      .select('id, alert_type, severity, risk_score, status, details, created_at, students(student_code, full_name), attendance_sessions(session_token)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin.from('biometric_profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabaseAdmin.from('face_verification_attempts').select('*', { count: 'exact', head: true }).eq('face_matched', false).gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
  ]);
  return NextResponse.json({ success: true, alerts: alerts || [], activeProfiles: activeProfiles || 0, recentFailures: recentFailures || 0 });
}

export async function PATCH(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...allowedRoles]);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const status = body.status === 'RESOLVED' || body.status === 'DISMISSED' || body.status === 'REVIEWING' ? body.status : null;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  if (!id || !status) return NextResponse.json({ success: false }, { status: 400 });
  const { error } = await supabaseAdmin.from('fraud_alerts').update({
    status,
    review_note: note || null,
    reviewed_by: auth.profile!.appUserId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
