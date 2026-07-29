import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

let cachedHealth: { until: number; body: Record<string, unknown>; status: number } | null = null;

export async function GET() {
  if (cachedHealth && cachedHealth.until > Date.now()) {
    return NextResponse.json(cachedHealth.body, {
      status: cachedHealth.status,
      headers: { 'Cache-Control': 'private, max-age=10' },
    });
  }
  const startedAt = Date.now();
  const { error } = await supabaseAdmin.from('attendance_sessions').select('id').limit(1);
  const body = {
    ok: !error,
    database: error ? 'degraded' : 'ok',
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };
  const status = error ? 503 : 200;
  cachedHealth = { until: Date.now() + 15_000, body, status };
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, max-age=10' } });
}
