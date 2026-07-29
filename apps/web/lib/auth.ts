import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@shared/index';
import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export type AuthProfile = {
  authUserId: string;
  appUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export async function getAuthProfile(): Promise<AuthProfile | null> {
  const authClient = await createSupabaseServerClient();
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user?.email) return null;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, status')
    .or(`auth_user_id.eq.${user.id},email.ilike.${user.email}`)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!profile) return null;
  return {
    authUserId: user.id,
    appUserId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole,
  };
}

export async function requirePageRole(roles: UserRole[]): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  if (!profile) redirect('/login');
  if (!roles.includes(profile.role)) {
    redirect(profile.role === 'STUDENT' ? '/student-portal' : '/login?error=forbidden');
  }
  return profile;
}

export async function requireApiRole(roles: UserRole[]) {
  const profile = await getAuthProfile();
  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json({ success: false, message: 'Chưa đăng nhập.' }, { status: 401 }),
    };
  }
  if (!roles.includes(profile.role)) {
    return {
      profile: null,
      response: NextResponse.json({ success: false, message: 'Không đủ quyền thực hiện.' }, { status: 403 }),
    };
  }
  return { profile, response: null };
}

export function rejectCrossSiteMutation(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || !host) return null;
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // Fall through to the rejection below.
  }
  return NextResponse.json({ success: false, message: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
}
