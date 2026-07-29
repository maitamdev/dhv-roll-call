import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import './globals.css';
import PwaLifecycle from '@/components/PwaLifecycle';

const manrope = Manrope({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-manrope',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DHV TapAttend · Quản lý điểm danh NFC',
  description: 'Nền tảng vận hành điểm danh NFC dành cho Đại học Hùng Vương.',
  applicationName: 'DHV TapAttend',
  icons: {
    icon: '/brand/dhv-link-mark.svg',
    shortcut: '/brand/dhv-link-mark.svg',
    apple: '/brand/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${manrope.variable} ${plexMono.variable} min-h-screen bg-background`}>
        {children}
        <PwaLifecycle />
      </body>
    </html>
  );
}
