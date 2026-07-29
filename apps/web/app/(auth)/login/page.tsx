'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Eye, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'LECTURER'>('LECTURER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    const profileResponse = await fetch('/api/auth/me', { cache: 'no-store' });
    const profileBody = await profileResponse.json().catch(() => null);
    const actualRole = profileBody?.profile?.role;
    if (!profileResponse.ok || !actualRole) {
      await supabase.auth.signOut();
      setError('Tài khoản chưa được liên kết với hồ sơ hợp lệ.');
      setLoading(false);
      return;
    }
    if (role === 'STUDENT' && actualRole !== 'STUDENT') {
      setError('Tài khoản này không phải tài khoản sinh viên.');
      setLoading(false);
      return;
    }
    if (role === 'LECTURER' && actualRole === 'STUDENT') {
      setError('Tài khoản này không có quyền cán bộ hoặc giảng viên.');
      setLoading(false);
      return;
    }
    router.push(actualRole === 'STUDENT' ? '/student-portal' : '/dashboard');
    router.refresh();
  }

  return (
    <div>
      <p className="page-kicker">Chào mừng trở lại</p>
      <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-950">Đăng nhập hệ thống</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Sử dụng tài khoản DHV để tiếp tục vào không gian của bạn.</p>

      <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        {([['LECTURER', 'Cán bộ / Giảng viên'], ['STUDENT', 'Sinh viên']] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setRole(value)} className={`rounded-[9px] px-3 py-2.5 text-xs font-bold ${role === value ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary'}`}>{label}</button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
        <label className="block">
          <span className="field-label">Tài khoản</span>
          <span className="relative block">
            <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="field pl-10" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email tài khoản DHV" required />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Mật khẩu</span>
            <Link href="#" className="text-[11px] font-bold text-secondary hover:underline">Quên mật khẩu?</Link>
          </span>
          <span className="relative block">
            <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="field px-10" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nhập mật khẩu" required />
            <Eye className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </span>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-secondary" /> Ghi nhớ đăng nhập trên thiết bị này</label>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Đăng nhập <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <p className="mt-7 text-center text-xs text-slate-500">Sinh viên chưa có tài khoản? <Link href="/register" className="font-bold text-primary hover:text-secondary">Đăng ký ngay</Link></p>
    </div>
  );
}
