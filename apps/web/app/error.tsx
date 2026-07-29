'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body className="grid min-h-screen place-items-center bg-[#f4f7fa] p-6 text-primary">
        <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-panel">
          <AlertTriangle className="mx-auto h-8 w-8 text-secondary" />
          <h1 className="mt-4 text-xl font-extrabold">DHV TapAttend cần tải lại</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Một module giao diện vừa gặp lỗi tạm thời. Dữ liệu điểm danh vẫn nằm trên máy chủ.</p>
          <button className="btn-primary mt-6" onClick={() => reset()}><RefreshCw className="h-4 w-4" /> Tải lại</button>
        </main>
      </body>
    </html>
  );
}
