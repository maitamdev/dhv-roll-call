'use client';

import { useState, useEffect } from 'react';
import { UserCheck, Calendar, Send, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StudentPortalPage() {
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [requestReason, setRequestReason] = useState('');

  const fetchStudentInfo = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('students')
        .select(`
          id, student_code, full_name, email,
          classes (class_name),
          student_cards (uid_masked, status),
          attendance_records (status)
        `)
        .limit(1)
        .single();

      if (data) {
        setStudentInfo(data);
      }
    } catch (err) {
      console.error('Error fetching student info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentInfo();
  }, []);

  const card = Array.isArray(studentInfo?.student_cards) ? studentInfo?.student_cards[0] : studentInfo?.student_cards;
  const cls = Array.isArray(studentInfo?.classes) ? studentInfo?.classes[0] : studentInfo?.classes;
  const recs = studentInfo?.attendance_records || [];

  const presentCount = recs.filter((r: any) => r.status === 'PRESENT').length;
  const lateCount = recs.filter((r: any) => r.status === 'LATE').length;
  const absentCount = recs.filter((r: any) => r.status === 'ABSENT').length;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Profile Summary Header */}
      <div className="bg-white border-2 border-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 border-2 border-red-600 flex items-center justify-center font-extrabold text-white text-xl">
            {studentInfo?.full_name?.charAt(0) || 'S'}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{studentInfo?.full_name || 'Mai Trần Thiện Tâm'}</h1>
            <p className="text-xs text-slate-600 font-medium">MSSV: {studentInfo?.student_code || '2305CT2001'} · Lớp: {cls?.class_name || 'CT07PM'} · Khoa CNTT</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-400">
                THẺ NFC: {card?.uid_masked || '80:74:**:**'} ({card?.status || 'ACTIVE'})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchStudentInfo} className="p-2.5 bg-slate-100 border border-slate-400 text-slate-800 hover:bg-slate-200">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold uppercase tracking-wider border border-slate-950 flex items-center gap-2"
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>GỬI ĐƠN ĐIỀU CHỈNH</span>
          </button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-300">
          <div className="text-xs font-bold text-slate-500 uppercase">Số buổi có mặt</div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">{presentCount} buổi</div>
          <p className="text-[11px] text-slate-600 mt-1 font-medium">Quẹt thẻ NFC đúng giờ</p>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <div className="text-xs font-bold text-slate-500 uppercase">Số buổi đi muộn</div>
          <div className="text-3xl font-extrabold text-amber-700 mt-1">{lateCount} buổi</div>
          <p className="text-[11px] text-slate-600 mt-1 font-medium">Được ghi nhận thành công</p>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <div className="text-xs font-bold text-slate-500 uppercase">Số buổi vắng</div>
          <div className="text-3xl font-extrabold text-slate-700 mt-1">{absentCount} buổi</div>
          <p className="text-[11px] text-emerald-700 font-bold mt-1">Đủ điều kiện dự thi</p>
        </div>
      </div>

      {/* Subject Attendance Breakdown */}
      <div className="bg-white border-2 border-slate-900 p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900 mb-4 border-b border-slate-200 pb-2">
          Lịch Sử Chuyên Cần Theo Môn Học
        </h2>

        <div className="space-y-3">
          <div className="p-4 bg-slate-50 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Lập trình Web nâng cao (INT1339)</h3>
              <p className="text-xs text-slate-600 font-medium">Giảng viên: TS. Nguyễn Văn An · 3 Tín chỉ</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-extrabold text-emerald-700">14 / 14 buổi (100%)</div>
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Đủ điều kiện dự thi</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <h3 className="text-sm font-extrabold uppercase text-slate-900">Gửi Yêu Cầu Điều Chỉnh Điểm Danh</h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Môn học cần điều chỉnh</label>
              <select className="w-full p-2.5 bg-slate-50 border border-slate-400 text-slate-900 text-xs font-bold">
                <option>Lập trình Web nâng cao - Buổi 27/07/2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Lý do điều chỉnh & Minh chứng</label>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Nhập lý do (Ví dụ: Thẻ bị lỗi quẹt 2 lần, có giấy xin phép vắng...)"
                className="w-full p-2.5 bg-slate-50 border border-slate-400 text-slate-900 text-xs font-medium h-24 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowAdjustmentModal(false)} className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold border border-slate-400">
                HỦY
              </button>
              <button
                onClick={() => {
                  alert('Đã gửi yêu cầu điều chỉnh lên giảng viên!');
                  setShowAdjustmentModal(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold border border-red-800"
              >
                GỬI ĐƠN
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
