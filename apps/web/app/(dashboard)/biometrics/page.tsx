'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, RefreshCw, ScanFace, ShieldAlert, Trash2 } from 'lucide-react';

type Student = {
  id: string;
  student_code: string;
  full_name: string;
  status: string;
  classes?: { class_name?: string } | { class_name?: string }[] | null;
  biometric: null | {
    status: string;
    sample_count: number;
    consented_at: string | null;
    enrolled_at: string | null;
    last_verified_at: string | null;
  };
};

export default function BiometricsPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/biometrics', { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    setStudents(body?.students || []);
  }, []);

  useEffect(() => { void load(); return () => streamRef.current?.getTracks().forEach((track) => track.stop()); }, [load]);

  async function startCamera() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setMessage({ tone: 'error', text: 'Không mở được camera. Hãy cấp quyền camera cho trình duyệt.' });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function enroll() {
    const video = videoRef.current;
    if (!video || !cameraOn || !selectedId || !consent) return;
    setBusy(true);
    setMessage(null);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0);
    const image = canvas.toDataURL('image/jpeg', 0.86);
    const response = await fetch('/api/admin/biometrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: selectedId, image, consent }),
    });
    const body = await response.json().catch(() => null);
    setMessage({ tone: response.ok ? 'success' : 'error', text: body?.message || 'Không thể đăng ký khuôn mặt.' });
    if (response.ok) {
      setConsent(false);
      await load();
    }
    setBusy(false);
  }

  async function revoke(studentId: string) {
    if (!window.confirm('Vô hiệu hóa hồ sơ khuôn mặt của sinh viên này?')) return;
    const response = await fetch(`/api/admin/biometrics?studentId=${encodeURIComponent(studentId)}`, { method: 'DELETE' });
    const body = await response.json().catch(() => null);
    setMessage({ tone: response.ok ? 'success' : 'error', text: body?.message || 'Không thể vô hiệu hóa.' });
    await load();
  }

  const selected = students.find((student) => student.id === selectedId);

  return (
    <div className="space-y-6 pb-12">
      <header className="page-header">
        <div>
          <p className="page-kicker">Sinh trắc học có kiểm soát</p>
          <h1 className="page-title flex items-center gap-2"><ScanFace className="h-6 w-6 text-secondary" /> Đăng ký khuôn mặt</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Ảnh được gửi thẳng tới engine nội bộ để tạo mẫu. TapAttend không lưu ảnh chụp trong Supabase.</p>
        </div>
        <button className="icon-button" onClick={() => void load()} aria-label="Làm mới"><RefreshCw className="h-4 w-4" /></button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card overflow-hidden">
          <div className="relative aspect-[4/3] bg-[#0b1729]">
            <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${cameraOn ? 'block' : 'hidden'}`} />
            {!cameraOn && (
              <div className="absolute inset-0 grid place-items-center text-center text-slate-300">
                <div><CameraOff className="mx-auto h-10 w-10 text-slate-500" /><p className="mt-3 text-sm font-bold">Camera đang tắt</p><p className="mt-1 text-xs text-slate-500">Bật camera khi sinh viên đã có mặt để xác nhận đồng ý.</p></div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-[12%] rounded-[42%] border border-white/50 shadow-[0_0_0_999px_rgba(4,12,24,0.28)]" />
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {!cameraOn ? <button className="btn-primary" onClick={() => void startCamera()}><Camera className="h-4 w-4" /> Bật camera</button> : <button className="btn-secondary" onClick={stopCamera}><CameraOff className="h-4 w-4" /> Tắt camera</button>}
            <span className="self-center text-xs text-slate-500">Một người trong khung, nhìn thẳng, không ngược sáng.</span>
          </div>
        </section>

        <section className="surface-card p-5">
          <p className="page-kicker">Hồ sơ được chọn</p>
          <label className="mt-4 block"><span className="field-label">Sinh viên</span>
            <select className="field" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Chọn sinh viên</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.student_code} · {student.full_name}</option>)}
            </select>
          </label>
          {selected && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong className="text-sm text-primary">{selected.full_name}</strong>
              <p className="mt-1 font-mono text-xs text-slate-500">{selected.student_code}</p>
              <p className="mt-3 text-xs text-slate-600">Trạng thái mẫu: <b>{selected.biometric?.status === 'ACTIVE' ? `Đang hoạt động · ${selected.biometric.sample_count} mẫu` : 'Chưa đăng ký'}</b></p>
            </div>
          )}
          <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-secondary" />
            <span>Sinh viên đã được thông báo mục đích, thời hạn lưu, quyền yêu cầu xóa và đồng ý đăng ký dữ liệu sinh trắc học phiên bản DHV-BIOMETRIC-2026-01.</span>
          </label>
          <button disabled={!selectedId || !cameraOn || !consent || busy} className="btn-primary mt-5 w-full" onClick={() => void enroll()}>
            <ScanFace className="h-4 w-4" /> {busy ? 'Đang xử lý mẫu…' : 'Chụp và đăng ký mẫu'}
          </button>
          {message && <div className={`mt-4 rounded-xl border p-3 text-xs font-semibold ${message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}
          <div className="mt-5 flex gap-3 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-secondary" /> Không dùng kết quả khuôn mặt làm căn cứ duy nhất để xử lý kỷ luật. Mọi trường hợp từ chối phải có quy trình khiếu nại và xác minh thủ công.</div>
        </section>
      </div>

      <section className="data-shell overflow-x-auto">
        <table className="data-table text-xs">
          <thead><tr><th>Sinh viên</th><th>Trạng thái</th><th>Số mẫu</th><th>Lần xác minh cuối</th><th className="text-right">Quyền dữ liệu</th></tr></thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}><td><b>{student.full_name}</b><span className="mt-1 block font-mono text-[10px] text-slate-500">{student.student_code}</span></td><td>{student.biometric?.status === 'ACTIVE' ? <span className="status-chip status-success"><CheckCircle2 className="h-3 w-3" /> Đã đăng ký</span> : <span className="status-chip status-warning">Chưa có mẫu</span>}</td><td>{student.biometric?.sample_count || 0}</td><td>{student.biometric?.last_verified_at ? new Date(student.biometric.last_verified_at).toLocaleString('vi-VN') : 'Chưa xác minh'}</td><td className="text-right">{student.biometric?.status === 'ACTIVE' && <button className="btn-secondary px-3 py-2 text-red-600" onClick={() => void revoke(student.id)}><Trash2 className="h-3.5 w-3.5" /> Vô hiệu hóa</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
