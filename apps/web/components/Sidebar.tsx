'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Nfc, 
  Settings,
  LogOut,
  GraduationCap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sidebarLinks = [
  { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Lịch học', href: '/dashboard/schedules', icon: CalendarDays },
  { name: 'Sinh viên', href: '/dashboard/students', icon: Users },
  { name: 'Phiên điểm danh', href: '/dashboard/sessions', icon: Nfc },
  { name: 'Quản lý Thẻ NFC', href: '/dashboard/cards', icon: GraduationCap },
  { name: 'Cài đặt', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col h-screen sticky top-0 hidden md:flex">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-jakarta font-bold text-primary flex items-center gap-2">
          <Nfc className="text-secondary h-6 w-6" />
          DHV TapAttend
        </h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {sidebarLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/5 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-colors">
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
