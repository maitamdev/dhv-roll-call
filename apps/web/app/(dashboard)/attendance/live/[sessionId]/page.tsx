'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  CheckCircle2, Clock, XCircle, Users, Search, 
  Smartphone, Volume2, X, Play, Square, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StudentRecord {
  id: string;
  studentCode: string;
  fullName: string;
  className: string;
  avatarUrl?: string;
  status: 'NOT_MARKED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  firstScanAt?: string;
  source?: string;
  isNew?: boolean;
}

import { fetchLiveSessionAdmin } from '../../../sessions/actions';

export default function LiveAttendancePage() {
  const params = useParams();
  const sessionId = (params?.sessionId as string) || 'ses11111-1111-1111-1111-111111111111';

  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Simulator state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [simCardUid, setSimCardUid] = useState('8074A1B2');
  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Manual Override state
  const [overrideRecord, setOverrideRecord] = useState<StudentRecord | null>(null);
  const [newStatus, setNewStatus] = useState<'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'>('PRESENT');
  const [overrideReason, setOverrideReason] = useState('');

  const playBeep = (type: 'success' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'success' ? 880 : 330;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  const fetchSessionAndRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchLiveSessionAdmin(sessionId);
      
      if (data.session) {
        setSessionInfo(data.session);
        setSessionStatus(data.session.status);
      }

      if (data.records) {
        const formatted: StudentRecord[] = data.records.map((r: any) => {
          const student = Array.isArray(r.students) ? r.students[0] : r.students;
          const cls = Array.isArray(student?.classes) ? student.classes[0] : student?.classes;
          return {
            id: student?.id || r.student_id,
            studentCode: student?.student_code || '',
            fullName: student?.full_name || '',
            className: cls?.class_name || 'CT07PM',
            avatarUrl: student?.avatar_url,
            status: r.status,
            firstScanAt: r.first_scan_at ? new Date(r.first_scan_at).toLocaleTimeString('vi-VN') : undefined,
            source: r.source
          };
        });
        setRecords(formatted);
      }

      if (data.students && data.students.length > 0) {
        setStudentsList(data.students);
        if (!selectedStudentId) {
          setSelectedStudentId(data.students[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching live session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndRecords();

    const channel = supabase
      .channel(`live_attendance_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          console.log('Realtime change:', payload);
          playBeep('success');
          fetchSessionAndRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const handleSimulateScan = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/nfc/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          cardUid: simCardUid,
          requestId: `WEB_SIM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          clientScannedAt: new Date().toISOString(),
          source: 'WEB_SIMULATOR'
        })
      });

      const data = await res.json();

      if (data.success && data.student) {
        playBeep('success');
        setToastMessage({ type: 'success', text: `Điểm danh thành công - ${data.student.fullName}` });
        fetchSessionAndRecords();
      } else {
        playBeep('error');
        setToastMessage({ type: 'error', text: `${data.message}` });
      }
    } catch (err: any) {
      playBeep('error');
      setToastMessage({ type: 'error', text: 'Lỗi kết nối API giả lập' });
    } finally {
      setIsSimulating(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const toggleSession = async () => {
    const targetAction = sessionStatus === 'OPEN' ? 'close' : 'open';
    try {
      const res = await fetch(`/api/attendance-sessions/${sessionId}/${targetAction}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSessionStatus(targetAction === 'open' ? 'OPEN' : 'CLOSED');
        setToastMessage({ type: 'info', text: data.message });
        fetchSessionAndRecords();
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e) {
      setToastMessage({ type: 'error', text: 'Lỗi khi thay đổi trạng thái phiên' });
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideRecord) return;
    try {
      await supabase
        .from('attendance_records')
        .update({
          status: newStatus,
          first_scan_at: new Date().toISOString(),
          source: 'MANUAL_OVERRIDE',
          manual_override: true,
          override_reason: overrideReason
        })
        .eq('session_id', sessionId)
        .eq('student_id', overrideRecord.id);

      setToastMessage({ type: 'success', text: `Đã cập nhật trạng thái cho ${overrideRecord.fullName}` });
      fetchSessionAndRecords();
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error override:', err);
    } finally {
      setOverrideRecord(null);
      setOverrideReason('');
    }
  };

  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const lateCount = records.filter(r => r.status === 'LATE').length;
  const absentCount = records.filter(r => r.status === 'ABSENT').length;
  const notMarkedCount = records.filter(r => r.status === 'NOT_MARKED').length;

  const filteredRecords = records.filter(r => {
    const matchesFilter = filter === 'ALL' || r.status === filter;
    const matchesSearch = r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.studentCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const sectionData = sessionInfo?.course_sections;
  const courseData = sectionData?.courses;
  const classData = sectionData?.classes;
  const roomData = sessionInfo?.rooms;

  return (
    <div className="space-y-6">
      
      {toastMessage && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-sm font-medium text-sm flex items-center gap-3 shadow-md ${
          toastMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
          toastMessage.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
          'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          <Volume2 className="w-5 h-5" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white border border-border rounded-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
              sessionStatus === 'OPEN' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {sessionStatus === 'OPEN' ? 'Đang điểm danh (Live)' : 'Phiên đã đóng'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary font-mono font-bold rounded-sm border border-primary/20 text-sm">
              <Hash className="w-4 h-4" />
              {sessionInfo?.session_token || '------'}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {courseData?.course_name || 'Lập trình Web nâng cao'} · Lớp {classData?.class_name || 'CT07PM'}
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Phòng {roomData?.room_code || 'A301'} · Giảng viên: {sectionData?.lecturers?.full_name || 'TS. Nguyễn Văn An'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchSessionAndRecords} 
            className="p-2.5 bg-white hover:bg-muted border border-input rounded-sm text-foreground transition-colors" 
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>

          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="px-4 py-2.5 bg-secondary text-white hover:bg-secondary/90 rounded-sm text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Smartphone className="w-4 h-4" />
            Giả lập quẹt thẻ
          </button>

          <button
            onClick={toggleSession}
            className={`px-4 py-2.5 text-sm font-medium rounded-sm border flex items-center gap-2 transition-colors shadow-sm ${
              sessionStatus === 'OPEN' 
                ? 'bg-white hover:bg-red-50 text-destructive border-input' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary'
            }`}
          >
            {sessionStatus === 'OPEN' ? (
              <>
                <Square className="w-4 h-4" />
                Đóng phiên
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Mở lại phiên
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-border rounded-sm shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{presentCount}</div>
            <div className="text-xs font-medium text-muted-foreground">CÓ MẶT</div>
          </div>
        </div>
        <div className="p-5 bg-white border border-border rounded-sm shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{lateCount}</div>
            <div className="text-xs font-medium text-muted-foreground">ĐI MUỘN</div>
          </div>
        </div>
        <div className="p-5 bg-white border border-border rounded-sm shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{absentCount}</div>
            <div className="text-xs font-medium text-muted-foreground">VẮNG MẶT</div>
          </div>
        </div>
        <div className="p-5 bg-white border border-border rounded-sm shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{notMarkedCount}</div>
            <div className="text-xs font-medium text-muted-foreground">CHƯA ĐIỂM DANH</div>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="bg-white border border-border rounded-sm shadow-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'PRESENT', label: 'Có mặt' },
              { id: 'LATE', label: 'Đi muộn' },
              { id: 'NOT_MARKED', label: 'Chưa quẹt' },
              { id: 'ABSENT', label: 'Vắng' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  filter === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên hoặc MSSV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 bg-white border border-input rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="py-3 px-6 font-medium">Sinh viên</th>
                <th className="py-3 px-6 font-medium">Mã sinh viên</th>
                <th className="py-3 px-6 font-medium">Lớp</th>
                <th className="py-3 px-6 font-medium">Thời gian</th>
                <th className="py-3 px-6 font-medium">Nguồn</th>
                <th className="py-3 px-6 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-6 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-4 px-6 font-medium text-foreground">{r.fullName}</td>
                  <td className="py-4 px-6 text-muted-foreground">{r.studentCode}</td>
                  <td className="py-4 px-6 text-muted-foreground">{r.className}</td>
                  <td className="py-4 px-6 font-mono text-muted-foreground">
                    {r.firstScanAt ? r.firstScanAt : '--:--'}
                  </td>
                  <td className="py-4 px-6">
                    {r.source === 'ANDROID_NFC' ? (
                      <span className="text-xs text-primary font-medium">App Android</span>
                    ) : r.source === 'WEB_SIMULATOR' ? (
                      <span className="text-xs text-purple-600 font-medium">Web Giả lập</span>
                    ) : r.source === 'MANUAL_OVERRIDE' ? (
                      <span className="text-xs text-amber-600 font-medium">Thủ công</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {r.status === 'PRESENT' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Có mặt</span>
                    )}
                    {r.status === 'LATE' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Đi muộn</span>
                    )}
                    {r.status === 'ABSENT' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Vắng</span>
                    )}
                    {r.status === 'NOT_MARKED' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Chưa quẹt</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => {
                        setOverrideRecord(r);
                        setNewStatus(r.status === 'NOT_MARKED' ? 'PRESENT' : r.status);
                      }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Không tìm thấy sinh viên nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulator Modal */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Smartphone className="w-5 h-5 text-secondary" />
                <h3>Giả lập quẹt thẻ NFC</h3>
              </div>
              <button onClick={() => setIsSimulatorOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Chọn sinh viên (Mẫu)</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                  }}
                  className="w-full p-2 border border-input rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {studentsList.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.student_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Mã UID Thẻ (Hex)</label>
                <input
                  type="text"
                  value={simCardUid}
                  onChange={(e) => setSimCardUid(e.target.value)}
                  className="w-full p-2 border border-input rounded-sm text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary bg-muted/30"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-sm text-xs text-blue-700 leading-relaxed">
                Thao tác này sẽ gửi request lên API thực tế <code>/api/nfc/scans</code> và kích hoạt Supabase Realtime tự động cập nhật bảng bên ngoài.
              </div>

              <button
                onClick={handleSimulateScan}
                disabled={isSimulating}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang quét...
                  </>
                ) : (
                  <>Chạm thẻ ngay</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold text-foreground">Sửa trạng thái thủ công</h3>
              <button onClick={() => setOverrideRecord(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Sinh viên</p>
                <p className="font-semibold text-foreground">{overrideRecord.fullName} ({overrideRecord.studentCode})</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Trạng thái mới</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full p-2 border border-input rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PRESENT">Có mặt</option>
                  <option value="LATE">Đi muộn</option>
                  <option value="EXCUSED">Vắng có phép</option>
                  <option value="ABSENT">Vắng không phép</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Lý do điều chỉnh (Audit)</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Ghi rõ lý do (ví dụ: Quên mang thẻ)..."
                  className="w-full p-2 border border-input rounded-sm text-sm h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setOverrideRecord(null)}
                  className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveOverride}
                  className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
