'use client';

import { Bell, CalendarDays, Menu, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import CommandPalette from './CommandPalette';

export default function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [health, setHealth] = useState<'ok' | 'degraded' | 'unknown'>('unknown');
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        if (active) setHealth(response.ok ? 'ok' : 'degraded');
      } catch {
        if (active) setHealth('degraded');
      }
    };
    void check();
    const timer = window.setInterval(check, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const now = new Date();
  const academicStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 xl:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button className="icon-button lg:hidden" onClick={onMenuClick} aria-label="Mở menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden w-[min(36vw,420px)] md:block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <button className="field flex items-center gap-2 pl-10 text-left text-slate-400" onClick={() => setPaletteOpen(true)}><span>Tìm sinh viên, lớp học, phiên điểm danh…</span><kbd className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-400">⌘ K</kbd></button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 lg:flex" title="Sức khỏe máy chủ">
          <span className={`h-1.5 w-1.5 rounded-full ${health === 'ok' ? 'bg-emerald-500' : health === 'degraded' ? 'bg-amber-500' : 'bg-slate-300'}`} />
          {health === 'ok' ? 'Máy chủ ổn định' : health === 'degraded' ? 'Cần kiểm tra' : 'Đang kiểm tra'}
        </div>
        <div className="hidden items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:flex">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span>Năm học {academicStartYear}–{academicStartYear + 1}</span>
        </div>
        <button className="icon-button relative" aria-label="Thông báo">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary ring-2 ring-white" />
        </button>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <KeyboardShortcut onOpen={() => setPaletteOpen(true)} />
    </header>
  );
}

function KeyboardShortcut({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
  return null;
}
