import { NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/auth';

export async function GET() {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, profile });
}
