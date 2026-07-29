'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ studentCode: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          student_code: form.studentCode,
          role: 'STUDENT',
        },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setMessage('Tài khoản đã được tạo. Vui lòng kiểm tra email để xác nhận.');
      setLoading(false);
      return;
    }
    router.push('/student-portal');
    router.refresh();
  }

  return (
    <div>
      <p className="page-kicker">Tài khoản sinh viên</p>
      <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-slate-950">Kích hoạt DHV TapAttend</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Thông tin phải trùng khớp với hồ sơ đào tạo của nhà trường.</p>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</div>}
        <label className="block"><span className="field-label">Mã số sinh viên</span><input className="field font-mono" value={form.studentCode} onChange={event => setForm({ ...form, studentCode: event.target.value })} required /></label>
        <label className="block"><span className="field-label">Họ và tên</span><input className="field" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} required /></label>
        <label className="block"><span className="field-label">Email trường cấp</span><input className="field" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label>
        <label className="block"><span className="field-label">Mật khẩu mới</span><input className="field" type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required /></label>
        <label className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><input type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-secondary" /> Tôi xác nhận thông tin trên là chính xác và đồng ý với quy định sử dụng hệ thống.</label>
        <button className="btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Kích hoạt tài khoản <ArrowRight className="h-4 w-4" /></>}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">Đã có tài khoản? <Link href="/login" className="font-bold text-primary hover:text-secondary">Đăng nhập</Link></p>
    </div>
  );
}
