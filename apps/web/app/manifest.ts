import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DHV TapAttend',
    short_name: 'TapAttend',
    description: 'Nền tảng quản lý điểm danh NFC Đại học Hùng Vương.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F4F7FA',
    theme_color: '#10233F',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
