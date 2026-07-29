'use client';

import { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import NetworkStatusBanner from './NetworkStatusBanner';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-transparent lg:flex">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1 lg:pl-[272px]">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <NetworkStatusBanner />
        <main className="px-4 py-5 sm:px-6 sm:py-7 xl:px-9">
          <div className="mx-auto max-w-[1480px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
