'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Calendar, Play, Square, Loader2 } from 'lucide-react';

export default function SessionsListPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase
        .from('attendance_sessions')
        .select(`
          id, status, scheduled_start, scheduled_end,
          course_sections (
            section_code,
            courses (course_name),
            classes (class_name)
          )
        `)
        .order('scheduled_start', { ascending: false });
      
      if (data) setSessions(data);
      setLoading(false);
    }
    fetchSessions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Phiên điểm danh</h2>
          <p className="text-muted-foreground mt-1">Danh sách các phiên học thực tế từ cơ sở dữ liệu.</p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-sm font-medium">
          + Tạo phiên mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-border p-12 text-center rounded-sm">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Chưa có phiên điểm danh nào</h3>
          <p className="text-muted-foreground mt-1">Hãy tạo phiên điểm danh đầu tiên bằng dữ liệu thật.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <Link key={session.id} href={`/attendance/live/${session.id}`} className="block group">
              <div className="bg-white border border-border rounded-sm p-5 hover:border-primary transition-colors shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-full border ${
                      session.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      session.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {session.status}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(session.scheduled_start).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {session.course_sections?.courses?.course_name || 'Không xác định'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lớp: {session.course_sections?.classes?.class_name || 'N/A'} · Mã HP: {session.course_sections?.section_code}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(session.scheduled_start).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {new Date(session.scheduled_end).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <div className="flex items-center text-primary font-medium gap-1">
                    {session.status === 'OPEN' ? <Play className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    Xem chi tiết
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
