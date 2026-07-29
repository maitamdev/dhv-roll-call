'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarCheck, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export default function StudentPortalPage() {
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  async function fetchStudentInfo() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.email) {
        setStudentInfo(null);
        return;
      }
      const { data } = await supabase
        .from('students')
        .select(`
          id, student_code, full_name, email,
          classes (class_name),
          student_cards (uid_masked, status),
          attendance_records (
            id, status,
            attendance_sessions (
              id, scheduled_start,
              course_sections (
                courses (course_code, course_name, credits),
                lecturers (full_name)
              )
            )
          )
        `)
        .eq('email', authData.user.email)
        .single();
      if (data) setStudentInfo(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStudentInfo(); }, []);

  async function submitAdjustment() {
    setSubmitting(true);
    setRequestMessage('');
    try {
      const response = await fetch('/api/student/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceRecordId: selectedRecordId, reason }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể gửi yêu cầu.');
      setRequestMessage('Yêu cầu đã được gửi và đang chờ giảng viên xử lý.');
      setReason('');
      setSelectedRecordId('');
      window.setTimeout(() => {
        setModalOpen(false);
        setRequestMessage('');
      }, 1_200);
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.');
    } finally {
      setSubmitting(false);
    }
  }

  const card = Array.isArray(studentInfo?.student_cards) ? studentInfo.student_cards[0] : studentInfo?.student_cards;
  const cls = Array.isArray(studentInfo?.classes) ? studentInfo.classes[0] : studentInfo?.classes;
  const records = studentInfo?.attendance_records || [];
  const present = records.filter((record: any) => record.status === 'PRESENT').length;
  const late = records.filter((record: any) => record.status === 'LATE').length;
  const absent = records.filter((record: any) => record.status === 'ABSENT').length;
  const total = Math.max(records.length, 1);
  const rate = Math.round(((present + late) / total) * 100);
  const courseSummaries = Object.values(records.reduce((groups: Record<string, any>, record: any) => {
    const session = Array.isArray(record.attendance_sessions) ? record.attendance_sessions[0] : record.attendance_sessions;
    const section = Array.isArray(session?.course_sections) ? session.course_sections[0] : session?.course_sections;
    const course = Array.isArray(section?.courses) ? section.courses[0] : section?.courses;
    const lecturer = Array.isArray(section?.lecturers) ? section.lecturers[0] : section?.lecturers;
    const key = course?.course_code || course?.course_name;
    if (!key) return groups;
    if (!groups[key]) {
      groups[key] = {
        code: course?.course_code,
        name: course?.course_name,
        credits: course?.credits,
        lecturer: lecturer?.full_name,
        total: 0,
        attended: 0,
      };
    }
    groups[key].total += 1;
    if (record.status === 'PRESENT' || record.status === 'LATE') groups[key].attended += 1;
    return groups;
  }, {})) as any[];

  if (!loading && !studentInfo) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background p-5">
        <div className="empty-state panel max-w-lg">
          <UserRound className="h-8 w-8 text-slate-300" />
          <h1 className="mt-4 text-lg font-bold">Không tìm thấy hồ sơ sinh viên</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Hãy đăng nhập bằng email đã được liên kết với hồ sơ sinh viên trong Supabase.</p>
          <Link href="/login" className="btn-primary mt-5">Đến trang đăng nhập</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] pb-12">
      <header className="border-b border-white/10 bg-primary text-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo inverse />
          <button onClick={fetchStudentInfo} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold hover:bg-white/10"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-9">
        <section className="relative overflow-hidden rounded-[18px] bg-primary p-6 text-white shadow-[0_20px_55px_rgba(16,35,63,.18)] sm:p-8">
          <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-xl font-extrabold">{studentInfo?.full_name?.charAt(0) || '—'}</div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Hồ sơ sinh viên</p>
                <h1 className="mt-1 text-2xl font-extrabold">{studentInfo?.full_name}</h1>
                <p className="mt-2 text-xs text-slate-300">MSSV {studentInfo?.student_code} · {cls?.class_name || 'Chưa xếp lớp'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-pill border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-3 w-3" /> Thẻ {card?.status || 'chưa kích hoạt'}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-mono text-[10px] text-slate-300">{card?.uid_masked || '**:**:**:**'}</span>
            </div>
          </div>
        </section>

        <section className="panel grid divide-y divide-slate-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {[
            ['Tỷ lệ chuyên cần', `${rate}%`, 'text-primary'],
            ['Có mặt', `${present} buổi`, 'text-emerald-600'],
            ['Đi muộn', `${late} buổi`, 'text-amber-600'],
            ['Vắng mặt', `${absent} buổi`, 'text-secondary'],
          ].map(([label, value, tone]) => (
            <div key={label} className="p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-2xl font-extrabold tracking-[-0.04em] ${tone}`}>{value}</p></div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div><p className="page-kicker">Học kỳ hiện tại</p><h2 className="text-lg font-bold">Chuyên cần theo môn học</h2></div>
              <CalendarCheck className="h-5 w-5 text-secondary" />
            </div>
            <div className="p-4 sm:p-5">
              {courseSummaries.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">Chưa có dữ liệu điểm danh theo môn học.</div>
              ) : courseSummaries.map(course => {
                const courseRate = course.total ? Math.round((course.attended / course.total) * 100) : 0;
                return (
                  <article key={course.code || course.name} className="group mb-3 rounded-xl border border-slate-200 p-4 hover:border-secondary/30 hover:bg-slate-50/60">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div><p className="text-sm font-extrabold text-slate-900">{course.name}</p><p className="mt-1 text-[11px] text-slate-500">{course.code || 'Chưa có mã'} · {course.credits || 0} tín chỉ · {course.lecturer || 'Chưa gán giảng viên'}</p></div>
                      <div className="text-left sm:text-right"><p className="text-sm font-extrabold text-emerald-600">{course.attended} / {course.total} buổi</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{courseRate}% chuyên cần</p></div>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${courseRate}%` }} /></div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="panel p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary/10 text-secondary"><Send className="h-5 w-5" /></span>
            <h2 className="mt-5 text-base font-bold">Cần điều chỉnh dữ liệu?</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Gửi yêu cầu kèm lý do để giảng viên kiểm tra lịch sử điểm danh.</p>
            <button onClick={() => setModalOpen(true)} className="btn-primary mt-5 w-full">Tạo yêu cầu <ArrowUpRight className="h-4 w-4" /></button>
          </aside>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white"><UserRound className="h-4 w-4" /></span>
              <div><h2 className="text-base font-bold">Yêu cầu điều chỉnh</h2><p className="mt-1 text-xs text-slate-500">Chọn đúng buổi học cần kiểm tra</p></div>
            </div>
            <label className="mt-6 block">
              <span className="field-label">Buổi điểm danh</span>
              <select className="field" value={selectedRecordId} onChange={(event) => setSelectedRecordId(event.target.value)}>
                <option value="">Chọn một buổi học</option>
                {records.map((record: any) => {
                  const session = Array.isArray(record.attendance_sessions) ? record.attendance_sessions[0] : record.attendance_sessions;
                  const section = Array.isArray(session?.course_sections) ? session.course_sections[0] : session?.course_sections;
                  const course = Array.isArray(section?.courses) ? section.courses[0] : section?.courses;
                  const date = session?.scheduled_start ? new Date(session.scheduled_start).toLocaleDateString('vi-VN') : 'Chưa rõ ngày';
                  return <option key={record.id} value={record.id}>{course?.course_code || course?.course_name || 'Học phần'} · {date} · {record.status}</option>;
                })}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="field-label">Lý do và minh chứng</span>
              <textarea className="field min-h-28 py-3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Mô tả vấn đề bạn gặp phải (tối thiểu 10 ký tự)…" />
            </label>
            {requestMessage && <p className={`mt-3 text-xs font-semibold ${requestMessage.startsWith('Yêu cầu đã') ? 'text-emerald-700' : 'text-red-700'}`}>{requestMessage}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" disabled={submitting} onClick={() => setModalOpen(false)}>Hủy</button>
              <button className="btn-primary disabled:opacity-50" disabled={submitting || !selectedRecordId || reason.trim().length < 10} onClick={() => void submitAdjustment()}>
                {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
