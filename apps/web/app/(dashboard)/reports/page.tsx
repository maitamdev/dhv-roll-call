'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';

type ReportRow = {
  id: string;
  code: string;
  name: string;
  present: number;
  late: number;
  absent: number;
  percentage: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [sessionCount, setSessionCount] = useState(0);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/reports/attendance', {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể tải báo cáo.');
      setReportData(payload.rows);
      setSessionCount(payload.sessionCount);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải báo cáo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const averageRate = useMemo(
    () => reportData.length
      ? Math.round(reportData.reduce((sum, row) => sum + row.percentage, 0) / reportData.length)
      : 0,
    [reportData],
  );
  const atRisk = useMemo(() => reportData.filter((row) => row.percentage < 80), [reportData]);

  function exportCsv() {
    if (!reportData.length) return;
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const header = ['Mã sinh viên', 'Họ và tên', 'Có mặt', 'Đi muộn', 'Vắng', 'Tỷ lệ chuyên cần', 'Đánh giá'];
    const rows = reportData.map((row) => [
      row.code,
      row.name,
      row.present,
      row.late,
      row.absent,
      `${row.percentage}%`,
      row.percentage >= 80 ? 'Đủ điều kiện thi' : 'Cảnh báo',
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bao-cao-chuyen-can-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="page-header">
        <div>
          <p className="page-kicker">Phân tích chuyên cần</p>
          <h1 className="page-title flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-secondary" />
            Báo cáo chuyên cần
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-600">
            Tổng hợp tại PostgreSQL để tải nhanh và không đưa lịch sử thô xuống trình duyệt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void fetchReports()} className="icon-button" aria-label="Làm mới báo cáo">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCsv} disabled={!reportData.length} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" />
            <span>XUẤT CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button onClick={() => void fetchReports()} className="font-bold hover:underline">Thử lại</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ['Tổng số buổi đã học', `${sessionCount} buổi`, 'Tất cả phiên trong cơ sở dữ liệu', 'text-slate-900'],
          ['Chuyên cần trung bình', `${averageRate}%`, 'Tính từ dữ liệu điểm danh hiện có', 'text-emerald-700'],
          ['Sinh viên cần chú ý', `${atRisk.length} sinh viên`, 'Tỷ lệ chuyên cần dưới 80%', 'text-amber-700'],
        ].map(([label, value, hint, tone]) => (
          <div key={label} className="panel p-5">
            <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-extrabold ${tone}`}>{loading ? '—' : value}</div>
            <div className="mt-1 text-[11px] font-medium text-slate-600">{hint}</div>
          </div>
        ))}
      </div>

      <div className="data-shell overflow-x-auto">
        <table className="data-table text-xs">
          <thead>
            <tr>
              <th className="px-4 py-3.5">Mã sinh viên</th>
              <th className="px-4 py-3.5">Họ và tên</th>
              <th className="px-4 py-3.5 text-center">Có mặt</th>
              <th className="px-4 py-3.5 text-center">Đi muộn</th>
              <th className="px-4 py-3.5 text-center">Vắng</th>
              <th className="px-4 py-3.5 text-center">Chuyên cần</th>
              <th className="px-4 py-3.5 text-right">Đánh giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && Array.from({ length: 5 }).map((_, index) => (
              <tr key={index} className="animate-pulse">
                {Array.from({ length: 7 }).map((__, cell) => (
                  <td key={cell} className="px-4 py-4"><div className="h-3 rounded bg-slate-100" /></td>
                ))}
              </tr>
            ))}
            {!loading && !error && reportData.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-slate-500">Chưa có dữ liệu chuyên cần.</td></tr>
            )}
            {!loading && reportData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3.5 font-mono font-bold text-slate-800">{row.code}</td>
                <td className="px-4 py-3.5 font-bold text-slate-900">{row.name}</td>
                <td className="px-4 py-3.5 text-center font-extrabold text-emerald-700">{row.present}</td>
                <td className="px-4 py-3.5 text-center font-bold text-amber-700">{row.late}</td>
                <td className="px-4 py-3.5 text-center font-bold text-red-700">{row.absent}</td>
                <td className="px-4 py-3.5 text-center font-extrabold text-slate-900">{row.percentage}%</td>
                <td className="px-4 py-3.5 text-right font-bold">
                  {row.percentage >= 80 ? (
                    <span className="text-emerald-700">Đủ điều kiện thi</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> Cần kiểm tra
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
