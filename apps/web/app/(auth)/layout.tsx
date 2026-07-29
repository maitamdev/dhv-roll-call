import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] bg-white lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[#10233f] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -right-5 -top-5 h-52 w-52 rounded-full border border-secondary/30" />
        <div className="absolute bottom-0 left-0 h-[44%] w-full opacity-[0.09]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        <BrandLogo inverse className="relative" />

        <div className="relative max-w-lg">
          <span className="status-pill border-white/10 bg-white/[0.06] text-slate-300"><Sparkles className="h-3 w-3 text-secondary" /> Vận hành thông minh</span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-[-0.045em] xl:text-5xl">Mỗi lần chạm thẻ,<br /><span className="text-secondary">một dữ liệu tin cậy.</span></h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Nền tảng điểm danh NFC theo thời gian thực dành cho giảng viên, sinh viên và phòng đào tạo Đại học Hùng Vương.</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Realtime & ngoại tuyến</p>
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-300"><ShieldCheck className="h-4 w-4 text-emerald-400" /> UID được bảo vệ HMAC</p>
          </div>
        </div>

        <p className="relative text-[10px] font-medium text-slate-500">© 2026 Trường Đại học Hùng Vương · Phú Thọ</p>
      </section>

      <section className="relative flex items-center justify-center bg-[#f7f9fb] p-5 sm:p-8">
        <BrandLogo className="absolute left-5 top-5 lg:hidden" />
        <div className="w-full max-w-[460px] rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,63,.10)] sm:p-9">
          {children}
        </div>
      </section>
    </main>
  );
}
