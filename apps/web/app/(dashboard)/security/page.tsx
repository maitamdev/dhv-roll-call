'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Eye, ScanFace, ShieldCheck } from 'lucide-react';

type Alert = {
  id: string;
  alert_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  status: string;
  details: Record<string, unknown>;
  created_at: string;
  students?: { student_code?: string; full_name?: string } | { student_code?: string; full_name?: string }[] | null;
};

export default function SecurityPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState({ activeProfiles: 0, recentFailures: 0 });

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/security', { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    setAlerts(body?.alerts || []);
    setMetrics({ activeProfiles: body?.activeProfiles || 0, recentFailures: body?.recentFailures || 0 });
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, status: 'REVIEWING' | 'RESOLVED' | 'DISMISSED') {
    await fetch('/api/admin/security', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-6 pb-12">
      <header><p className="page-kicker">Trung tâm liêm chính</p><h1 className="page-title flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-secondary" /> Giám sát gian lận</h1><p className="mt-1 text-sm text-slate-500">Ưu tiên điều tra theo tín hiệu và bằng chứng, không tự động kết luận vi phạm.</p></header>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card"><ScanFace className="h-5 w-5 text-emerald-600" /><p className="mt-5 text-3xl font-extrabold text-primary">{metrics.activeProfiles}</p><p className="mt-1 text-xs font-semibold text-slate-500">Hồ sơ khuôn mặt hoạt động</p></div>
        <div className="metric-card"><AlertTriangle className="h-5 w-5 text-secondary" /><p className="mt-5 text-3xl font-extrabold text-primary">{metrics.recentFailures}</p><p className="mt-1 text-xs font-semibold text-slate-500">Xác minh thất bại trong 24 giờ</p></div>
        <div className="metric-card"><Eye className="h-5 w-5 text-blue-600" /><p className="mt-5 text-3xl font-extrabold text-primary">{alerts.filter((alert) => alert.status === 'OPEN').length}</p><p className="mt-1 text-xs font-semibold text-slate-500">Cảnh báo đang chờ xem xét</p></div>
      </div>
      <div className="data-shell overflow-x-auto">
        <table className="data-table text-xs">
          <thead><tr><th>Thời điểm</th><th>Sinh viên</th><th>Tín hiệu</th><th>Rủi ro</th><th>Trạng thái</th><th className="text-right">Xử lý</th></tr></thead>
          <tbody>
            {alerts.map((alert) => {
              const student = Array.isArray(alert.students) ? alert.students[0] : alert.students;
              return <tr key={alert.id}><td>{new Date(alert.created_at).toLocaleString('vi-VN')}</td><td><b>{student?.full_name || 'Chưa xác định'}</b><span className="block font-mono text-[10px] text-slate-500">{student?.student_code}</span></td><td>{alert.alert_type.replaceAll('_', ' ')}</td><td><span className={`status-chip ${alert.risk_score >= 80 ? 'status-danger' : 'status-warning'}`}>{alert.risk_score}/100 · {alert.severity}</span></td><td>{alert.status}</td><td className="text-right"><div className="flex justify-end gap-2">{alert.status === 'OPEN' && <button className="btn-secondary px-3 py-2" onClick={() => void review(alert.id, 'REVIEWING')}>Nhận xử lý</button>}<button className="btn-secondary px-3 py-2" onClick={() => void review(alert.id, 'RESOLVED')}>Đã xác minh</button></div></td></tr>;
            })}
            {alerts.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-500">Không có cảnh báo gian lận.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
