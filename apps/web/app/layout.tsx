import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DHV TapAttend - Hệ Thống Điểm Danh Sinh Viên NFC Real-time',
  description: 'Hệ thống điểm danh sinh viên chuyên nghiệp sử dụng thẻ NFC dành cho Đại học Hùng Vương.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-outfit">
        {children}
      </body>
    </html>
  );
}
