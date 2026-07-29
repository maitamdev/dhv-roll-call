'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty-state">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-secondary"><AlertTriangle className="h-6 w-6" /></span>
      <h2 className="mt-4 text-lg font-bold text-primary">Không tải được màn hình này</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Dữ liệu có thể đang gián đoạn. Thử tải lại trước khi thực hiện thao tác điểm danh.</p>
      <button className="btn-primary mt-5" onClick={() => reset()}><RefreshCw className="h-4 w-4" /> Thử lại</button>
    </div>
  );
}
