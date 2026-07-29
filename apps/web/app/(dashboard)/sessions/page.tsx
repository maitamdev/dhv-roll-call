'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock3,
  Hash,
  Loader2,
  MapPin,
  Plus,
  ScanFace,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  createSessionAdmin,
  deleteSessionAdmin,
  fetchCourseSectionsAdmin,
  fetchRoomsAdmin,
  fetchSessionsAdmin,
} from './actions';

export default function SessionsListPage() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    course_section_id: '',
    room_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '09:00',
    scan_deadline_time: '09:00',
    late_after_minutes: 15,
    face_verification_required: true,
    open_immediately: true,
  });

  async function loadData() {
    setLoading(true);
    const [sessionsData, sectionsData, roomsData] = await Promise.all([
      fetchSessionsAdmin(),
      fetchCourseSectionsAdmin(),
      fetchRoomsAdmin(),
    ]);
    setSessions(sessionsData);
    setSections(sectionsData);
    setRooms(roomsData);
    const requestedSectionId = searchParams.get('courseSectionId');
    const requestedSection = sectionsData.find((section) => section.id === requestedSectionId);
    setFormData((current) => ({
      ...current,
      course_section_id: requestedSection?.id || current.course_section_id || sectionsData[0]?.id || '',
      room_id: current.room_id || roomsData[0]?.id || '',
    }));
    if (requestedSection) setShowModal(true);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    // Search params are used only for deep-linking from an assigned course section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body) => setCanDelete(['ADMIN', 'TRAINING_OFFICE'].includes(body?.profile?.role)))
      .catch(() => setCanDelete(false));
  }, []);

  async function handleCreateSession(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    try {
      const start = new Date(`${formData.date}T${formData.start_time}:00`);
      const end = new Date(`${formData.date}T${formData.end_time}:00`);
      const deadline = new Date(`${formData.date}T${formData.scan_deadline_time}:00`);
      const lateAfter = new Date(start.getTime() + formData.late_after_minutes * 60_000);
      const result = await createSessionAdmin({
        course_section_id: formData.course_section_id,
        room_id: formData.room_id,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        scanDeadline: deadline.toISOString(),
        lateAfter: lateAfter.toISOString(),
        faceVerificationRequired: formData.face_verification_required,
        openImmediately: formData.open_immediately,
      });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setShowModal(false);
      await loadData();
    } catch {
      setFormError('Ngày giờ không hợp lệ. Hãy kiểm tra lại thông tin buổi học.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSession(event: React.MouseEvent, sessionId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm('Xóa phiên đã đóng này và toàn bộ dữ liệu liên quan?')) return;
    const result = await deleteSessionAdmin(sessionId);
    if (!result.success) {
      window.alert(result.error);
      return;
    }
    await loadData();
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="page-header">
        <div>
          <p className="page-kicker">Vận hành điểm danh</p>
          <h1 className="page-title">Buổi học & điểm danh</h1>
          <p className="page-description">Tạo buổi học theo đúng học phần, phòng, thời gian và chính sách xác minh.</p>
        </div>
        <button onClick={() => { setFormError(''); setShowModal(true); }} className="btn-primary">
          <Plus className="h-4 w-4" /> Tạo buổi học
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state panel">
          <Calendar className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold">Chưa có buổi học nào</h2>
          <p className="mt-2 text-sm text-slate-500">Chọn học phần đã được phân công rồi tạo buổi học đầu tiên.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => {
            const room = Array.isArray(session.rooms) ? session.rooms[0] : session.rooms;
            const section = Array.isArray(session.course_sections) ? session.course_sections[0] : session.course_sections;
            const course = Array.isArray(section?.courses) ? section.courses[0] : section?.courses;
            const cls = Array.isArray(section?.classes) ? section.classes[0] : section?.classes;
            return (
              <Link key={session.id} href={`/attendance/live/${session.id}`} className="group block">
                <article className="panel flex h-full flex-col justify-between p-5 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-[0_18px_40px_rgba(16,35,63,0.1)]">
                  <div>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className={`status-chip ${session.status === 'OPEN' ? 'status-success' : session.status === 'DRAFT' ? 'status-warning' : ''}`}>
                        {session.status === 'OPEN' ? 'Đang mở' : session.status === 'DRAFT' ? 'Bản nháp' : 'Đã đóng'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md border border-primary/15 bg-primary/5 px-2 py-1 font-mono text-xs font-bold text-primary"><Hash className="h-3 w-3" />{session.session_token}</span>
                        {canDelete && session.status !== 'OPEN' && <button onClick={(event) => void handleDeleteSession(event, session.id)} className="icon-button h-8 w-8 text-red-600" aria-label="Xóa phiên"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                    <h2 className="line-clamp-1 text-lg font-extrabold text-slate-950 group-hover:text-primary">{course?.course_name || 'Chưa xác định môn học'}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{section?.section_code} · {cls?.class_name || 'Chưa xếp lớp'}</p>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 p-3"><Clock3 className="h-4 w-4 text-secondary" /><p className="mt-2 font-bold text-slate-800">{new Date(session.scheduled_start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.scheduled_end).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(session.scheduled_start).toLocaleDateString('vi-VN')}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><MapPin className="h-4 w-4 text-secondary" /><p className="mt-2 font-bold text-slate-800">{room?.room_code || 'Chưa gán phòng'}</p><p className="mt-1 text-[10px] text-slate-500">{room?.building || 'Máy quét chưa thể tự nhận phiên'}</p></div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1 text-slate-500">{session.face_verification_required ? <ScanFace className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldCheck className="h-3.5 w-3.5" />}{session.face_verification_required ? 'NFC + khuôn mặt' : 'Chỉ NFC'}</span>
                    <span className="text-primary">Mở chi tiết</span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div><h2 className="text-lg font-extrabold text-slate-950">Tạo buổi học mới</h2><p className="mt-1 text-xs text-slate-500">Máy quét trong phòng sẽ tự nhận phiên khi phiên được mở.</p></div>
              <button onClick={() => setShowModal(false)} className="icon-button h-9 w-9" aria-label="Đóng"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-5 p-5 sm:p-6">
              {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{formError}</div>}
              {sections.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Bạn chưa được phân công học phần nào. Hãy liên hệ Admin/Phòng đào tạo.</div>}
              {rooms.length === 0 && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center">
                  <span>Chưa có phòng học. Admin cần tạo phòng trước khi tạo buổi học.</span>
                  <Link href="/rooms" className="shrink-0 font-extrabold text-primary underline underline-offset-4">Tạo phòng ngay</Link>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="field-label">Học phần</span><select required className="field" value={formData.course_section_id} onChange={(event) => setFormData({ ...formData, course_section_id: event.target.value })}><option value="">Chọn học phần</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.courses?.course_code} · {section.courses?.course_name} · {section.section_code}</option>)}</select></label>
                <label><span className="field-label">Phòng học</span><select required className="field" value={formData.room_id} onChange={(event) => setFormData({ ...formData, room_id: event.target.value })}><option value="">Chọn phòng</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.room_code} · {room.building} · {room.capacity} chỗ</option>)}</select></label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label><span className="field-label">Ngày học</span><input required type="date" className="field" value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} /></label>
                <label><span className="field-label">Bắt đầu</span><input required type="time" className="field" value={formData.start_time} onChange={(event) => setFormData({ ...formData, start_time: event.target.value })} /></label>
                <label><span className="field-label">Kết thúc</span><input required type="time" className="field" value={formData.end_time} onChange={(event) => setFormData({ ...formData, end_time: event.target.value, scan_deadline_time: event.target.value })} /></label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="field-label">Đi muộn sau (phút)</span><input required min={1} max={180} type="number" className="field" value={formData.late_after_minutes} onChange={(event) => setFormData({ ...formData, late_after_minutes: Number(event.target.value) })} /><span className="mt-1 block text-[10px] text-slate-500">Tính từ giờ bắt đầu.</span></label>
                <label><span className="field-label">Hạn nhận lượt quét</span><input required type="time" className="field" value={formData.scan_deadline_time} onChange={(event) => setFormData({ ...formData, scan_deadline_time: event.target.value })} /><span className="mt-1 block text-[10px] text-slate-500">Không được vượt quá giờ kết thúc.</span></label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#e85555]" checked={formData.face_verification_required} onChange={(event) => setFormData({ ...formData, face_verification_required: event.target.checked })} />
                  <span><strong className="block text-sm text-slate-900">Xác minh khuôn mặt</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Yêu cầu NFC + liveness + đối chiếu khuôn mặt.</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#e85555]" checked={formData.open_immediately} onChange={(event) => setFormData({ ...formData, open_immediately: event.target.checked })} />
                  <span><strong className="block text-sm text-slate-900">Mở phiên ngay</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Bỏ chọn để lưu bản nháp và mở sau.</span></span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Hủy</button>
                <button type="submit" disabled={isSubmitting || sections.length === 0 || rooms.length === 0} className="btn-primary disabled:opacity-50">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tạo buổi học</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
