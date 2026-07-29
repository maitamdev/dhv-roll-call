'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PwaLifecycle() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaitingWorker(worker);
        });
      });
    }).catch(() => {
      // The web remains fully functional without install support.
    });
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!waitingWorker) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(16,35,63,0.18)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary"><RefreshCw className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-primary">Có phiên bản TapAttend mới</p><p className="mt-1 text-[11px] text-slate-500">Cập nhật giao diện và hiệu năng ngay.</p></div>
      <button className="btn-primary min-h-9 px-3 py-1.5 text-xs" onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}>Cập nhật</button>
    </div>
  );
}
