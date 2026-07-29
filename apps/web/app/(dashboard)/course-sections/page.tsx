'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  addStudentsToCourseSectionAdmin,
  assignLecturerToCourseSection,
  createCourseSectionAdmin,
  fetchCourseSectionWorkspace,
  removeStudentFromCourseSectionAdmin,
} from './actions';

type WorkspaceData = Awaited<ReturnType<typeof fetchCourseSectionWorkspace>>['data'];

function single<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

export default function CourseSectionsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceData>({
    sections: [], courses: [], semesters: [], lecturers: [], classes: [], students: [],
  });
  const [actorRole, setActorRole] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    sectionCode: '',
    courseCode: '',
    courseName: '',
    credits: 3,
    semesterId: '',
    lecturerId: '',
    classId: '',
  });

  const loadWorkspace = useCallback(async (preferredSectionId?: string) => {
    setLoading(true);
    const result = await fetchCourseSectionWorkspace();
    setWorkspace(result.data);
    setActorRole(result.actorRole);
    if (!result.success) setMessage({ tone: 'error', text: result.error });
    const nextId = preferredSectionId || selectedSectionId || result.data.sections[0]?.id || '';
    if (nextId && result.data.sections.some((section: any) => section.id === nextId)) setSelectedSectionId(nextId);
    setForm((current) => ({
      ...current,
      semesterId: current.semesterId || result.data.semesters.find((semester: any) => semester.status === 'ACTIVE')?.id || result.data.semesters[0]?.id || '',
      lecturerId: current.lecturerId || result.data.lecturers[0]?.id || '',
      classId: current.classId || result.data.classes[0]?.id || '',
    }));
    setLoading(false);
  }, [selectedSectionId]);

  useEffect(() => {
    void loadWorkspace();
    // The initial fetch should run once; subsequent refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSection: any = workspace.sections.find((section: any) => section.id === selectedSectionId);
  const enrollments = (selectedSection?.enrollments || []).filter((enrollment: any) => enrollment.status === 'ACTIVE');
  const enrolledIds = useMemo(() => new Set(enrollments.map((enrollment: any) => enrollment.student_id)), [enrollments]);
  const availableStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return workspace.students.filter((student: any) => {
      if (enrolledIds.has(student.id)) return false;
      const classInfo: any = single(student.classes);
      return !query || `${student.student_code} ${student.full_name} ${student.email || ''} ${classInfo?.class_name || ''}`.toLocaleLowerCase('vi').includes(query);
    });
  }, [enrolledIds, search, workspace.students]);

  async function createSection(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await createCourseSectionAdmin(form);
    if (result.success) {
      setShowCreate(false);
      setForm((current) => ({ ...current, sectionCode: '' }));
      setMessage({ tone: 'success', text: 'Đã tạo lớp học phần. Bạn có thể thêm sinh viên ngay.' });
      await loadWorkspace(result.id);
    } else {
      setMessage({ tone: 'error', text: result.error });
    }
    setSaving(false);
  }

  async function addStudents() {
    if (!selectedSectionId || !selectedStudentIds.length) return;
    setSaving(true);
    setMessage(null);
    const result = await addStudentsToCourseSectionAdmin(selectedSectionId, selectedStudentIds);
    if (result.success) {
      setSelectedStudentIds([]);
      setMessage({ tone: 'success', text: `Đã thêm ${result.count} sinh viên vào lớp học phần.` });
      await loadWorkspace(selectedSectionId);
    } else {
      setMessage({ tone: 'error', text: result.error });
    }
    setSaving(false);
  }

  async function removeStudent(studentId: string, studentName: string) {
    if (!window.confirm(`Xóa ${studentName} khỏi lớp học phần này?`)) return;
    setSaving(true);
    const result = await removeStudentFromCourseSectionAdmin(selectedSectionId, studentId);
    if (result.success) {
      setMessage({ tone: 'success', text: `Đã xóa ${studentName} khỏi lớp học phần.` });
      await loadWorkspace(selectedSectionId);
    } else {
      setMessage({ tone: 'error', text: result.error });
    }
    setSaving(false);
  }

  async function assignLecturer() {
    if (!selectedSectionId || !single<any>(selectedSection?.lecturers)?.id) return;
    setAssigning(true);
    setMessage(null);
    const result = await assignLecturerToCourseSection(selectedSectionId, single<any>(selectedSection.lecturers).id);
    setMessage(result.success
      ? { tone: 'success', text: 'Đã cập nhật giảng viên phụ trách học phần.' }
      : { tone: 'error', text: result.error });
    if (result.success) await loadWorkspace(selectedSectionId);
    setAssigning(false);
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="page-header">
        <div>
          <p className="page-kicker">Tổ chức đào tạo</p>
          <h1 className="page-title flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6 text-secondary" />
            Học phần
          </h1>
          <p className="page-description">Tạo môn học + lớp học phần trong một bước, sau đó quản lý danh sách sinh viên trước khi mở phiên điểm danh.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void loadWorkspace(selectedSectionId)} className="icon-button" aria-label="Làm mới">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {actorRole !== 'LECTURER' && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Tạo học phần
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
          message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {message.tone === 'success' && <Check className="h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid min-h-[600px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-bold text-slate-900">Danh sách lớp</p>
            <p className="mt-1 text-[11px] text-slate-500">{workspace.sections.length} lớp trong phạm vi phụ trách</p>
          </div>
          <div className="max-h-[680px] space-y-1 overflow-y-auto p-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <div key={index} className="m-2 h-20 animate-pulse rounded-xl bg-slate-100" />)
            ) : workspace.sections.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-4 text-sm font-bold text-slate-800">Chưa có học phần</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{actorRole === 'LECTURER' ? 'Bạn sẽ thấy học phần sau khi được Admin hoặc Phòng đào tạo phân công.' : 'Tạo môn học và lớp học phần đầu tiên để thêm sinh viên và mở phiên điểm danh.'}</p>
                {actorRole !== 'LECTURER' && <button onClick={() => setShowCreate(true)} className="btn-primary mt-5">Tạo học phần ngay</button>}
              </div>
            ) : workspace.sections.map((section: any) => {
              const course: any = single(section.courses);
              const lecturer: any = single(section.lecturers);
              const activeCount = (section.enrollments || []).filter((item: any) => item.status === 'ACTIVE').length;
              const active = section.id === selectedSectionId;
              return (
                <button
                  key={section.id}
                  onClick={() => { setSelectedSectionId(section.id); setSelectedStudentIds([]); setSearch(''); }}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    active ? 'border-secondary/40 bg-secondary/[0.06] shadow-[0_8px_24px_rgba(16,35,63,.06)]' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">{course?.course_name || 'Chưa có môn học'}</p>
                      <p className="mt-1 font-mono text-[10px] font-bold text-secondary">{section.section_code}</p>
                    </div>
                    <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${active ? 'text-secondary' : 'text-slate-300'}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate pr-2">{lecturer?.full_name || 'Chưa gán giảng viên'}</span>
                    <span className="shrink-0 font-bold text-slate-700">{activeCount} SV</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel overflow-hidden">
          {!selectedSection ? (
            <div className="grid min-h-[580px] place-items-center p-6 text-center">
              <div>
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-4 text-sm font-bold text-slate-800">Chọn hoặc tạo một lớp học phần</p>
                <p className="mt-2 text-xs text-slate-500">Thông tin và danh sách sinh viên sẽ hiển thị tại đây.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold text-white">{selectedSection.section_code}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{selectedSection.status}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-extrabold text-slate-950">{single<any>(selectedSection.courses)?.course_name}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {single<any>(selectedSection.semesters)?.semester_name} · {single<any>(selectedSection.classes)?.class_name} · {single<any>(selectedSection.lecturers)?.full_name}
                    </p>
                  </div>
                  <div className="flex items-end gap-3">
                    <Link href={`/sessions?courseSectionId=${selectedSectionId}`} className="btn-primary shrink-0">
                      <Plus className="h-4 w-4" /> Tạo buổi học
                    </Link>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <p className="text-2xl font-extrabold text-primary">{enrollments.length}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sinh viên</p>
                    </div>
                  </div>
                </div>
                {actorRole !== 'LECTURER' && (
                  <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
                    <label className="block flex-1">
                      <span className="field-label">Giảng viên phụ trách</span>
                      <select
                        className="field"
                        value={single<any>(selectedSection.lecturers)?.id || ''}
                        onChange={(event) => setWorkspace((current: any) => ({
                          ...current,
                          sections: current.sections.map((item: any) => item.id === selectedSectionId
                            ? { ...item, lecturers: current.lecturers.find((lecturer: any) => lecturer.id === event.target.value) || null }
                            : item),
                        }))}
                      >
                        <option value="">Chọn giảng viên</option>
                        {workspace.lecturers.map((lecturer: any) => <option key={lecturer.id} value={lecturer.id}>{lecturer.lecturer_code} · {lecturer.full_name}</option>)}
                      </select>
                    </label>
                    <button onClick={() => void assignLecturer()} disabled={assigning || !single<any>(selectedSection.lecturers)?.id} className="btn-secondary disabled:opacity-50">
                      {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Lưu phân công
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div><p className="text-sm font-bold text-slate-900">Danh sách đã đăng ký</p><p className="mt-1 text-[11px] text-slate-500">Sinh viên sẽ được tạo bản ghi khi mở phiên.</p></div>
                  </div>
                  <div className="max-h-[480px] overflow-y-auto">
                    {enrollments.length === 0 ? (
                      <div className="px-5 py-14 text-center text-xs text-slate-500">Chưa có sinh viên. Chọn sinh viên ở cột bên phải để thêm.</div>
                    ) : enrollments.map((enrollment: any) => {
                      const student: any = single(enrollment.students);
                      return (
                        <div key={enrollment.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-extrabold text-primary">{student?.full_name?.charAt(0) || '?'}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-900">{student?.full_name}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{student?.student_code} · {single<any>(student?.classes)?.class_name || 'Chưa xếp lớp'}</p>
                          </div>
                          <button onClick={() => void removeStudent(student.id, student.full_name)} disabled={saving} className="icon-button h-8 w-8 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Xóa ${student?.full_name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {actorRole !== 'LECTURER' && <aside className="bg-slate-50/60">
                  <div className="border-b border-slate-100 p-4">
                    <p className="text-sm font-bold text-slate-900">Thêm sinh viên</p>
                    <div className="relative mt-3">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-9 text-xs" placeholder="Tìm MSSV hoặc họ tên" />
                    </div>
                  </div>
                  <div className="max-h-[370px] overflow-y-auto p-2">
                    {availableStudents.length === 0 ? (
                      <p className="px-3 py-10 text-center text-xs leading-5 text-slate-500">Không còn sinh viên phù hợp để thêm.</p>
                    ) : availableStudents.map((student: any) => {
                      const checked = selectedStudentIds.includes(student.id);
                      return (
                        <label key={student.id} className={`mb-1 flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${checked ? 'border-secondary/30 bg-white' : 'border-transparent hover:bg-white'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedStudentIds((current) => checked ? current.filter((id) => id !== student.id) : [...current, student.id])}
                            className="h-4 w-4 accent-[#e85555]"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-slate-800">{student.full_name}</span>
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{student.student_code}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-200 p-4">
                    <button onClick={() => void addStudents()} disabled={saving || selectedStudentIds.length === 0} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Thêm {selectedStudentIds.length || ''} sinh viên
                    </button>
                  </div>
                </aside>}
              </div>
            </>
          )}
        </section>
      </div>

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div><h2 className="text-lg font-extrabold text-slate-950">Tạo học phần</h2><p className="mt-1 text-xs text-slate-500">Hệ thống sẽ tạo môn học và lớp học phần cùng lúc.</p></div>
              <button onClick={() => setShowCreate(false)} className="icon-button h-9 w-9" aria-label="Đóng"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={createSection} className="space-y-4 p-5 sm:p-6">
              <div className="rounded-xl border border-secondary/20 bg-secondary/[0.04] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-secondary">Thông tin môn học</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-[.75fr_1fr_110px]">
                  <label className="block"><span className="field-label">Mã môn</span><input required maxLength={30} className="field font-mono uppercase" value={form.courseCode} onChange={(event) => setForm({ ...form, courseCode: event.target.value })} placeholder="VD: CNTT101" /></label>
                  <label className="block"><span className="field-label">Tên môn học</span><input required maxLength={160} className="field" value={form.courseName} onChange={(event) => setForm({ ...form, courseName: event.target.value })} placeholder="VD: Lập trình web" /></label>
                  <label className="block"><span className="field-label">Tín chỉ</span><input required min={1} max={10} type="number" className="field" value={form.credits} onChange={(event) => setForm({ ...form, credits: Number(event.target.value) })} /></label>
                </div>
              </div>
              <label className="block"><span className="field-label">Mã lớp học phần</span><input required maxLength={30} className="field font-mono uppercase" value={form.sectionCode} onChange={(event) => setForm({ ...form, sectionCode: event.target.value })} placeholder="VD: CNTT101-01" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="field-label">Học kỳ</span><select required className="field" value={form.semesterId} onChange={(event) => setForm({ ...form, semesterId: event.target.value })}><option value="">Chọn học kỳ</option>{workspace.semesters.map((semester: any) => <option key={semester.id} value={semester.id}>{semester.semester_name} ({semester.semester_code})</option>)}</select></label>
                <label className="block"><span className="field-label">Lớp hành chính</span><select required className="field" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}><option value="">Chọn lớp</option>{workspace.classes.map((item: any) => <option key={item.id} value={item.id}>{item.class_code} · {item.class_name}</option>)}</select></label>
              </div>
              <label className="block"><span className="field-label">Giảng viên phụ trách</span><select required disabled={actorRole === 'LECTURER'} className="field disabled:bg-slate-100" value={form.lecturerId} onChange={(event) => setForm({ ...form, lecturerId: event.target.value })}><option value="">Chọn giảng viên</option>{workspace.lecturers.map((lecturer: any) => <option key={lecturer.id} value={lecturer.id}>{lecturer.lecturer_code} · {lecturer.full_name}</option>)}</select>{actorRole === 'LECTURER' && <span className="mt-1 block text-[10px] text-slate-500">Lớp mới tự động gán cho tài khoản giảng viên hiện tại.</span>}</label>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tạo học phần</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
