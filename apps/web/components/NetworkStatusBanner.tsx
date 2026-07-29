'use client';

import { useEffect, useState } from 'react';
import { CloudOff, Wifi } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const update = () => {
      const next = navigator.onLine;
      setOnline(next);
      if (next) {
        setShowRestored(true);
        window.setTimeout(() => setShowRestored(false), 2200);
      }
    };
    setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online && !showRestored) return null;
  return (
    <div className={`border-b px-4 py-2 text-xs font-semibold ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <div className="mx-auto flex max-w-[1480px] items-center gap-2">
        {online ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
        {online ? 'Đã kết nối lại. Dữ liệu đang được làm mới.' : 'Mất kết nối mạng. Không ghi nhận điểm danh chưa xác minh.'}
      </div>
    </div>
  );
}
