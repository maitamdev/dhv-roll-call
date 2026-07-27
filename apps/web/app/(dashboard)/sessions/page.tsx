'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Play, Square, Loader2, X, Plus, Hash } from 'lucide-react';
import { fetchSessionsAdmin, fetchCourseSectionsAdmin, createSessionAdmin } from './actions';

export default function SessionsListPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    course_section_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '09:00',
  });

  const loadData = async () => {
    setLoading(true);
    const [sessionsData, sectionsData] = await Promise.all([
      fetchSessionsAdmin(),
      fetchCourseSectionsAdmin()
    ]);
    
    setSessions(sessionsData);
    setSections(sectionsData);
    if (sectionsData.length > 0 && !formData.course_section_id) {
      setFormData(prev => ({ ...prev, course_section_id: sectionsData[0].id }));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const startDateTime = new Date(`${formData.date}T${formData.start_time}:00`).toISOString();
    const endDateTime = new Date(`${formData.date}T${formData.end_time}:00`).toISOString();
    const scanDeadline = endDateTime;
    const lateAfter = new Date(new Date(`${formData.date}T${formData.start_time}:00`).getTime() + 30 * 60000).toISOString();

    const result = await createSessionAdmin({
      course_section_id: formData.course_section_id,
      startDateTime,
      endDateTime,
      scanDeadline,
      lateAfter,
      token
    });

    if (result.success) {
      setShowModal(false);
      loadData();
    } else {
      alert('Lỗi tạo phiên: ' + result.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Phiên điểm danh</h2>
          <p className="text-muted-foreground mt-1">Danh sách các phiên học thực tế từ cơ sở dữ liệu.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Tạo phiên mới
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
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary font-mono font-bold rounded-sm border border-primary/20 text-xs">
                      <Hash className="w-3 h-3" />
                      {session.session_token || '------'}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-lg">Tạo Phiên Điểm Danh Mới</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Lớp học phần</label>
                <select 
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.course_section_id}
                  onChange={(e) => setFormData({...formData, course_section_id: e.target.value})}
                  required
                >
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.courses?.course_name} ({s.classes?.class_name}) - {s.section_code}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày học</label>
                <input 
                  type="date" 
                  className="w-full border border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Giờ bắt đầu</label>
                  <input 
                    type="time" 
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Giờ kết thúc</label>
                  <input 
                    type="time" 
                    className="w-full border border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-input text-foreground rounded-sm font-medium hover:bg-muted"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo Phiên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
