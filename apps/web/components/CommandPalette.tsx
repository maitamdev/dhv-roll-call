'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Command, Search, X } from 'lucide-react';

const commands = [
  { label: 'Mở tổng quan', hint: 'Dashboard', href: '/dashboard' },
  { label: 'Quản lý học phần', hint: 'Courses & sections', href: '/course-sections' },
  { label: 'Tạo phiên điểm danh', hint: 'Sessions', href: '/sessions' },
  { label: 'Quản lý sinh viên', hint: 'Students', href: '/students' },
  { label: 'Đăng ký khuôn mặt', hint: 'Biometrics', href: '/biometrics' },
  { label: 'Xem cảnh báo gian lận', hint: 'Security', href: '/security' },
  { label: 'Quản lý máy quét', hint: 'Devices', href: '/devices' },
];

export default function CommandPalette({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return commands.filter((item) => !normalized || `${item.label} ${item.hint}`.toLowerCase().includes(normalized));
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Tìm nhanh">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/40 bg-white shadow-[0_30px_100px_rgba(16,35,63,0.3)]">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search className="h-5 w-5 text-secondary" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm màn hình hoặc thao tác…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
          <button onClick={onClose} className="icon-button h-8 w-8" aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {filtered.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose} className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white"><Command className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{item.label}</strong><span className="text-[11px] text-slate-400">{item.hint}</span></span>
              <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-secondary" />
            </Link>
          ))}
          {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Không tìm thấy thao tác phù hợp.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-semibold text-slate-400"><span>Điều hướng nhanh</span><span className="font-mono">ESC đóng</span></div>
      </div>
    </div>
  );
}
