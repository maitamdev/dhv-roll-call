'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Camera,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Laptop,
  Nfc,
  ScanFace,
  Sparkles,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const AttendanceTrendChart = dynamic(() => import('@/components/AttendanceTrendChart'), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

type DailyPoint = { name: string; total: number };

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalStudents: 0, totalScans: 0, activeClasses: 0 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<DailyPoint[]>([]);

  useEffect(() => {
    async function loadRealData() {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const [{ count: studentCount }, { count: scanCount }, { count: classCount }, { data: scans }, { data: weeklyScans }] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('scan_events').select('*', { count: 'estimated', head: true }),
          supabase.from('classes').select('*', { count: 'exact', head: true }),
          supabase.from('scan_events').select('id,result_code,card_uid_hash,server_received_at').order('server_received_at', { ascending: false }).limit(5),
          supabase.from('scan_events').select('server_received_at').gte('server_received_at', sevenDaysAgo.toISOString()).limit(5000),
        ]);
        setStats({
          totalStudents: studentCount || 0,
          totalScans: scanCount || 0,
          activeClasses: classCount || 0,
        });
        setRecentLogs(scans || []);
        const dayFormatter = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' });
        const buckets = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(sevenDaysAgo);
          date.setDate(date.getDate() + index);
          return { key: date.toISOString().slice(0, 10), name: dayFormatter.format(date).replace('Th ', 'T'), total: 0 };
        });
        const byDay = new Map(buckets.map((item) => [item.key, item]));
        (weeklyScans || []).forEach((scan) => {
          const key = new Date(scan.server_received_at).toISOString().slice(0, 10);
          const bucket = byDay.get(key);
          if (bucket) bucket.total += 1;
        });
        setChartData(buckets.map(({ name, total }) => ({ name, total })));
      } finally {
        setLoading(false);
      }
    }
    loadRealData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Đang tải tổng quan">
        <div className="skeleton h-28" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="skeleton h-28" /><div className="skeleton h-28" /><div className="skeleton h-28" />
        </div>
        <div className="skeleton h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="page-header">
        <div>
          <p className="page-kicker">Trung tâm vận hành</p>
          <h1 className="page-title">Tổng quan vận hành</h1>
          <p className="page-description">Theo dõi nhịp điểm danh và những việc cần xử lý trong hôm nay.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-pill border-emerald-200 bg-emerald-50 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Hệ thống ổn định
          </span>
        </div>
      </section>

      <section className="panel grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { label: 'Sinh viên đang quản lý', value: stats.totalStudents, hint: 'Hồ sơ hoạt động', icon: Users },
          { label: 'Lượt quét đã ghi nhận', value: stats.totalScans, hint: 'Toàn bộ hệ thống', icon: Nfc },
          { label: 'Lớp học đang vận hành', value: stats.activeClasses, hint: 'Trong học kỳ này', icon: CalendarClock },
        ].map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="group flex items-center gap-4 px-5 py-5 sm:px-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(16,35,63,0.16)]">
              <Icon className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <strong className="text-2xl font-extrabold tracking-[-0.04em] text-slate-950">{value.toLocaleString('vi-VN')}</strong>
                <span className="text-[10px] text-slate-400">{hint}</span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-secondary" />
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/sessions', icon: Camera, eyebrow: 'Bắt đầu nhanh', label: 'Mở phiên điểm danh', tone: 'bg-secondary text-white' },
          { href: '/biometrics', icon: ScanFace, eyebrow: 'Chống gian lận', label: 'Kiểm tra hồ sơ khuôn mặt', tone: 'bg-primary text-white' },
          { href: '/devices', icon: Laptop, eyebrow: 'Thiết bị', label: 'Kiểm tra máy quét', tone: 'bg-white text-primary border border-slate-200' },
        ].map(({ href, icon: Icon, eyebrow, label, tone }) => (
          <Link key={href} href={href} className={`group rounded-2xl p-4 shadow-[0_10px_26px_rgba(16,35,63,0.07)] transition-transform hover:-translate-y-0.5 ${tone}`}>
            <div className="flex items-center justify-between"><Icon className="h-5 w-5" /><ArrowRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-1" /></div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] opacity-65">{eyebrow}</p>
            <p className="mt-1 text-sm font-extrabold">{label}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <section className="panel p-5 sm:p-6">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="page-kicker">Xu hướng tuần</p>
              <h2 className="text-lg font-bold text-slate-950">Lưu lượng điểm danh</h2>
            </div>
            <select className="field min-h-9 w-auto py-1.5 text-xs">
              <option>7 ngày gần nhất</option>
              <option>30 ngày gần nhất</option>
            </select>
          </div>
          <div className="h-[290px]">
            <AttendanceTrendChart data={chartData} />
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <p className="page-kicker">Realtime</p>
              <h2 className="text-lg font-bold">Hoạt động gần đây</h2>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/10 text-secondary">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLogs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Nfc className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-600">Chưa có lượt quét nào</p>
                <p className="mt-1 text-xs text-slate-400">Hoạt động mới sẽ xuất hiện tại đây.</p>
              </div>
            ) : recentLogs.map((log) => {
              const ok = log.result_code === 'ATTENDANCE_RECORDED';
              return (
                <div key={log.id} className="flex items-center gap-3 px-5 py-4">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {ok ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{ok ? 'Điểm danh thành công' : 'Lượt quét cần kiểm tra'}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-400">UID {log.card_uid_hash?.slice(0, 10)}••••</p>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">
                    {log.server_received_at ? new Date(log.server_received_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
