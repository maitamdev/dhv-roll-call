'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  Nfc,
  FileBarChart,
  GraduationCap,
  Laptop,
  ScanFace,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import BrandLogo from './BrandLogo';
import type { UserRole } from '@shared/index';

const links: { name: string; href: string; icon: typeof LayoutDashboard; roles?: UserRole[] }[] = [
  { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Lịch học', href: '/schedules', icon: CalendarDays },
  { name: 'Học phần', href: '/course-sections', icon: BookOpenCheck },
  { name: 'Phiên điểm danh', href: '/sessions', icon: Nfc },
  { name: 'Sinh viên', href: '/students', icon: Users, roles: ['ADMIN', 'TRAINING_OFFICE'] },
  { name: 'Thẻ NFC', href: '/cards', icon: GraduationCap, roles: ['ADMIN', 'TRAINING_OFFICE'] },
  { name: 'Thiết bị', href: '/devices', icon: Laptop, roles: ['ADMIN', 'TRAINING_OFFICE'] },
  { name: 'Khuôn mặt', href: '/biometrics', icon: ScanFace, roles: ['ADMIN', 'TRAINING_OFFICE'] },
  { name: 'Chống gian lận', href: '/security', icon: ShieldCheck, roles: ['ADMIN', 'TRAINING_OFFICE'] },
  { name: 'Báo cáo', href: '/reports', icon: FileBarChart, roles: ['ADMIN', 'TRAINING_OFFICE'] },
  { name: 'Cài đặt', href: '/settings', icon: Settings, roles: ['ADMIN', 'TRAINING_OFFICE'] },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ name: string; role: string; initials: string }>({
    name: 'Chưa đăng nhập',
    role: 'Không có phiên xác thực',
    initials: '--',
  });
  const [appRole, setAppRole] = useState<UserRole | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.auth.getUser(),
      fetch('/api/auth/me', { cache: 'no-store' }).then((response) => response.json()).catch(() => null),
    ]).then(([authResult, authProfile]) => {
      setAppRole(authProfile?.profile?.role || null);
      const { data } = authResult;
      const user = data.user;
      if (!user) return;
      const name = authProfile?.profile?.fullName || user.user_metadata?.full_name || user.email || 'Người dùng DHV';
      setProfile({
        name,
        role: authProfile?.profile?.role || user.user_metadata?.role || 'Tài khoản DHV',
        initials: name.split(/\s+/).map((part: string) => part[0]).join('').slice(-2).toUpperCase(),
      });
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-40 bg-primary/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-hidden bg-[#10233f] text-white shadow-[18px_0_50px_rgba(16,35,63,0.12)] transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <BrandLogo inverse />
          </Link>
          <button className="icon-button border-white/10 bg-white/5 text-white lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-6">
          <p className="px-3 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">Không gian quản trị</p>
        </div>
        <nav className="scrollbar-thin mt-3 flex-1 space-y-1 overflow-y-auto px-3">
          {links.filter((link) => !link.roles || !appRole || link.roles.includes(appRole)).map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-semibold',
                  active
                    ? 'bg-secondary text-white shadow-[0_8px_18px_rgba(232,85,85,0.22)]'
                    : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="flex-1">{link.name}</span>
                <ChevronRight className={cn('h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-70', active && 'opacity-80')} />
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-[14px] border border-white/10 bg-white/[0.05] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-white/10 text-xs font-extrabold">{profile.initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{profile.name}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{profile.role}</p>
            </div>
            <button aria-label="Đăng xuất" className="p-2 text-slate-400 hover:text-white" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
