'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState('STUDENT');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Dummy login redirect
    setTimeout(() => {
      router.push('/dashboard');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">Đăng nhập tài khoản</h2>
      </div>

      <div className="flex bg-muted/50 p-1 rounded-md">
        <button
          type="button"
          onClick={() => setRole('STUDENT')}
          className={`flex-1 text-sm font-medium py-2 rounded-sm transition-colors ${role === 'STUDENT' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Sinh viên
        </button>
        <button
          type="button"
          onClick={() => setRole('LECTURER')}
          className={`flex-1 text-sm font-medium py-2 rounded-sm transition-colors ${role === 'LECTURER' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Giảng viên
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {role === 'STUDENT' ? 'Nhập mã Sinh viên hoặc Email của bạn' : 'Nhập Email Giảng viên (dhv.edu.vn)'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none" htmlFor="email">
            Tài khoản
          </label>
          <input
            id="email"
            placeholder="MSSV hoặc Email"
            type="text"
            required
            className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium leading-none" htmlFor="password">
              Mật khẩu
            </label>
            <Link href="#" className="text-xs font-medium text-primary hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Sinh viên chưa có tài khoản? </span>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
}
