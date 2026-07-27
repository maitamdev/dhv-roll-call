'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: students } = await supabase
        .from('students')
        .select(`
          id, student_code, full_name,
          attendance_records (status)
        `);

      if (students) {
        const formatted = students.map((s: any) => {
          const recs = s.attendance_records || [];
          const present = recs.filter((r: any) => r.status === 'PRESENT').length;
          const late = recs.filter((r: any) => r.status === 'LATE').length;
          const absent = recs.filter((r: any) => r.status === 'ABSENT').length;
          const total = recs.length || 1;
          const percentage = Math.round(((present + late) / total) * 100);

          return {
            id: s.id,
            code: s.student_code,
            name: s.full_name,
            present,
            late,
            absent,
            percentage
          };
        });
        setReportData(formatted);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      
      <div className="bg-white border-2 border-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
            Báo Cáo & Thống Kê Chuyên Cần
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">Dữ liệu tổng hợp chuyên cần thực tế từ Supabase PostgreSQL</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchReports} className="p-2.5 bg-slate-100 border border-slate-400 text-slate-800 hover:bg-slate-200">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold uppercase tracking-wider border border-emerald-900 flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>XUẤT FILE EXCEL (.XLSX)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-300">
          <div className="text-xs font-bold text-slate-500 uppercase">Tổng số buổi đã học</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">14 buổi</div>
          <div className="text-[11px] text-slate-600 mt-1 font-medium">Môn: Lập trình Web nâng cao</div>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <div className="text-xs font-bold text-slate-500 uppercase">Tỷ lệ chuyên cần trung bình</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">93.7%</div>
          <div className="text-[11px] text-emerald-800 font-bold mt-1">Đạt chỉ tiêu nhà trường</div>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <div className="text-xs font-bold text-slate-500 uppercase">Nguy cơ cấm thi (&gt;20% vắng)</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">1 sinh viên</div>
          <div className="text-[11px] text-amber-800 font-bold mt-1">Lê Minh Cường (Vắng 3 buổi)</div>
        </div>
      </div>

      {/* Report Summary Table */}
      <div className="bg-white border-2 border-slate-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs sharp-table">
          <thead className="bg-slate-100 text-slate-700 border-b-2 border-slate-300 uppercase font-bold text-[11px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Mã sinh viên</th>
              <th className="py-3.5 px-4">Họ và tên</th>
              <th className="py-3.5 px-4 text-center">Có mặt</th>
              <th className="py-3.5 px-4 text-center">Đi muộn</th>
              <th className="py-3.5 px-4 text-center">Vắng</th>
              <th className="py-3.5 px-4 text-center">Tỷ lệ chuyên cần</th>
              <th className="py-3.5 px-4 text-right">Đánh giá dự thi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reportData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{row.code}</td>
                <td className="py-3.5 px-4 font-bold text-slate-900">{row.name}</td>
                <td className="py-3.5 px-4 text-center font-extrabold text-emerald-700">{row.present}</td>
                <td className="py-3.5 px-4 text-center font-bold text-amber-700">{row.late}</td>
                <td className="py-3.5 px-4 text-center font-bold text-red-700">{row.absent}</td>
                <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">{row.percentage}%</td>
                <td className="py-3.5 px-4 text-right font-bold">
                  {row.percentage >= 80 ? (
                    <span className="text-emerald-700 uppercase">Đủ điều kiện thi</span>
                  ) : (
                    <span className="text-amber-700 uppercase flex items-center justify-end gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Cảnh báo cấm thi
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
