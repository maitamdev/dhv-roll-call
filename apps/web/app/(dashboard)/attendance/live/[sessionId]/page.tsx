'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  CheckCircle2, Clock, XCircle, Users, Search, 
  Volume2, X, Play, Square, RefreshCw, Hash, Repeat2
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
  const [realtimeStatus, setRealtimeStatus] = useState<'CONNECTING' | 'LIVE' | 'FALLBACK'>('CONNECTING');
  
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

  const fetchSessionAndRecords = async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
            className: cls?.class_name || 'Chưa xếp lớp',
            avatarUrl: student?.avatar_url,
            status: r.status,
            firstScanAt: r.first_scan_at ? new Date(r.first_scan_at).toLocaleTimeString('vi-VN') : undefined,
            source: r.source
          };
        });
        setRecords(formatted);
      }

    } catch (err) {
      console.error('Error fetching live session:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndRecords();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionInfo?.id) return;

    const channel = supabase
      .channel(`live_attendance_${sessionInfo.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' }, // Bypass filter issue
        (payload) => {
          console.log('Realtime change:', payload);
          // If the payload has a session_id, verify it. If missing (due to replica default), just fetch anyway!
          const newRec = payload.new as any;
          if (!newRec.session_id || newRec.session_id === sessionInfo.id) {
            playBeep('success');
            fetchSessionAndRecords(false);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'scan_update' },
        (payload) => {
          console.log('Realtime broadcast:', payload);
          playBeep('success');
          fetchSessionAndRecords(false);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('LIVE');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('FALLBACK');
        }
      });

    // Reconcile occasionally even when Realtime is healthy. Hidden tabs do not
    // poll, and background refreshes never replace the page with a skeleton.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchSessionAndRecords(false);
    }, 20_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionInfo?.id]);

  const toggleSession = async () => {
    const targetAction = sessionStatus === 'OPEN' ? 'close' : 'open';
    try {
      const res = await fetch(`/api/attendance-sessions/${sessionId}/${targetAction}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSessionStatus(targetAction === 'open' ? 'OPEN' : 'CLOSED');
        setToastMessage({ type: 'info', text: data.message });
        fetchSessionAndRecords(false);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e) {
      setToastMessage({ type: 'error', text: 'Lỗi khi thay đổi trạng thái phiên' });
    }
  };

  const startRandomRescan = async () => {
    const response = await fetch(`/api/attendance-sessions/${sessionId}/rescan`, { method: 'POST' });
    const data = await response.json().catch(() => null);
    setToastMessage({
      type: response.ok ? 'success' : 'error',
      text: data?.message || 'Không thể bắt đầu tái xác minh',
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveOverride = async () => {
    if (!overrideRecord) return;
    try {
      const response = await fetch(`/api/attendance-sessions/${sessionId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: overrideRecord.id, status: newStatus, reason: overrideReason }),
      });
      const body = await response.json().catch(() => null);
      setToastMessage({
        type: response.ok ? 'success' : 'error',
        text: response.ok ? `Đã cập nhật trạng thái cho ${overrideRecord.fullName}` : body?.message || 'Không thể cập nhật',
      });
      if (!response.ok) return;
    fetchSessionAndRecords(false);
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
      <div className="page-header">
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
            <span className={`status-chip ${realtimeStatus === 'LIVE' ? 'status-success' : realtimeStatus === 'FALLBACK' ? 'status-warning' : ''}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${realtimeStatus === 'LIVE' ? 'bg-emerald-500' : realtimeStatus === 'FALLBACK' ? 'bg-amber-500' : 'bg-slate-400'}`} />
              {realtimeStatus === 'LIVE' ? 'Realtime' : realtimeStatus === 'FALLBACK' ? 'Đồng bộ dự phòng' : 'Đang kết nối'}
            </span>
          </div>

          <h1 className="page-title">
            {courseData?.course_name || 'Chưa có tên học phần'} · Lớp {classData?.class_name || 'Chưa xếp lớp'}
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Phòng {roomData?.room_code || 'Chưa gán'} · Giảng viên: {sectionData?.lecturers?.full_name || 'Chưa gán'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchSessionAndRecords()}
            className="icon-button"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
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
          {sessionStatus === 'OPEN' && (
            <button onClick={startRandomRescan} className="btn-secondary">
              <Repeat2 className="h-4 w-4" />
              Tái xác minh ngẫu nhiên
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel flex items-center gap-4 p-5">
          <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{presentCount}</div>
            <div className="text-xs font-medium text-muted-foreground">CÓ MẶT</div>
          </div>
        </div>
        <div className="panel flex items-center gap-4 p-5">
          <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{lateCount}</div>
            <div className="text-xs font-medium text-muted-foreground">ĐI MUỘN</div>
          </div>
        </div>
        <div className="panel flex items-center gap-4 p-5">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground">{absentCount}</div>
            <div className="text-xs font-medium text-muted-foreground">VẮNG MẶT</div>
          </div>
        </div>
        <div className="panel flex items-center gap-4 p-5">
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
      <div className="data-shell">
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
              className="field w-full pl-9 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
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
                            <span className="text-xs text-secondary font-medium">Web Giả lập</span>
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

      {/* Override Modal */}
      {overrideRecord && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
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
                  className="field"
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
                  className="field h-24 py-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setOverrideRecord(null)}
                  className="btn-secondary"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveOverride}
                  className="btn-primary"
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
