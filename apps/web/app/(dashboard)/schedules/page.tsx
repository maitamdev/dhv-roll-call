'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const weekdayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

export default function SchedulesPage() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);

  async function loadSchedules() {
    setLoading(true);
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        id, weekday, start_time, end_time,
        rooms (room_code),
        course_sections (
          section_code,
          courses (course_name),
          classes (class_name)
        )
      `)
      .order('weekday')
      .order('start_time');
    if (error) console.error('Error fetching schedules:', error);
    setSchedules(data || []);
    setLoading(false);
  }

  useEffect(() => { loadSchedules(); }, []);

  const weekDates = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay() || 7;
    monday.setDate(today.getDate() - day + 1);
    return weekdayLabels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { label, date };
    });
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <div className="page-header">
        <div>
          <p className="page-kicker">Kế hoạch giảng dạy</p>
          <h1 className="page-title flex items-center gap-2"><CalendarDays className="h-6 w-6 text-secondary" /> Lịch học</h1>
          <p className="page-description">Dữ liệu lịch học phần đang được đồng bộ trực tiếp từ Supabase.</p>
        </div>
        <button className="btn-secondary" onClick={loadSchedules}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
      </div>

      <div className="toolbar">
        <div>
          <p className="text-sm font-bold text-slate-900">
            Tuần {weekDates[0].date.toLocaleDateString('vi-VN')} – {weekDates[4].date.toLocaleDateString('vi-VN')}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lịch từ cơ sở dữ liệu</p>
        </div>
        <span className="status-pill border-slate-200 bg-slate-50 text-slate-600">{schedules.length} lịch học</span>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-5">{weekdayLabels.map(label => <div key={label} className="skeleton h-[330px]" />)}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {weekDates.map(({ label, date }, index) => {
            const daySchedules = schedules.filter(schedule => Number(schedule.weekday) === index + 1);
            return (
              <section key={label} className="panel min-h-[330px] overflow-hidden">
                <header className="border-b bg-slate-50/70 px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{date.getDate().toString().padStart(2, '0')}</p>
                </header>
                <div className="space-y-3 p-3">
                  {daySchedules.length ? daySchedules.map(schedule => {
                    const section = Array.isArray(schedule.course_sections) ? schedule.course_sections[0] : schedule.course_sections;
                    const course = Array.isArray(section?.courses) ? section.courses[0] : section?.courses;
                    const cls = Array.isArray(section?.classes) ? section.classes[0] : section?.classes;
                    const room = Array.isArray(schedule.rooms) ? schedule.rooms[0] : schedule.rooms;
                    return (
                      <article key={schedule.id} className="rounded-xl border border-primary/10 bg-primary/[0.04] p-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {String(schedule.start_time).slice(0, 5)}–{String(schedule.end_time).slice(0, 5)}</div>
                        <h2 className="mt-3 text-xs font-extrabold leading-5 text-slate-900">{course?.course_name || 'Chưa có tên học phần'}</h2>
                        <p className="mt-1 text-[10px] text-slate-500">{cls?.class_name || section?.section_code || 'Chưa xếp lớp'}</p>
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-500"><MapPin className="h-3 w-3" /> {room?.room_code || 'Chưa gán phòng'}</p>
                      </article>
                    );
                  }) : (
                    <div className="flex min-h-40 flex-col items-center justify-center text-center">
                      <CalendarDays className="h-6 w-6 text-slate-200" />
                      <p className="mt-2 text-[11px] font-semibold text-slate-400">Không có lịch học</p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
