import { Bell, Database, KeyRound, Save, Settings, ShieldCheck } from 'lucide-react';

const sections = [
  { icon: ShieldCheck, title: 'Chính sách điểm danh', description: 'Quy tắc ghi nhận đi muộn và thời hạn quét thẻ.' },
  { icon: Bell, title: 'Thông báo hệ thống', description: 'Email cảnh báo thiết bị, phiên học và tỷ lệ chuyên cần.' },
  { icon: Database, title: 'Dữ liệu & đồng bộ', description: 'Trạng thái Supabase Realtime và hàng đợi ngoại tuyến.' },
  { icon: KeyRound, title: 'Bảo mật thẻ NFC', description: 'Quản lý khóa HMAC và chính sách luân chuyển khóa.' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-10">
      <div className="page-header">
        <div>
          <p className="page-kicker">Cấu hình nền tảng</p>
          <h1 className="page-title flex items-center gap-2"><Settings className="h-6 w-6 text-secondary" /> Cài đặt</h1>
          <p className="page-description">Quản lý các quy tắc vận hành chung của DHV TapAttend.</p>
        </div>
        <button className="btn-primary"><Save className="h-4 w-4" /> Lưu thay đổi</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav className="panel h-fit p-2">
          {sections.map(({ icon: Icon, title, description }, index) => (
            <button key={title} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ${index === 0 ? 'bg-primary text-white' : 'hover:bg-slate-50'}`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${index === 0 ? 'text-secondary' : 'text-slate-400'}`} />
              <span>
                <span className="block text-xs font-bold">{title}</span>
                <span className={`mt-1 block text-[10px] leading-4 ${index === 0 ? 'text-slate-300' : 'text-slate-400'}`}>{description}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="panel overflow-hidden">
          <header className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold">Chính sách điểm danh</h2>
            <p className="mt-1 text-xs text-slate-500">Áp dụng cho các phiên được tạo mới trên toàn hệ thống.</p>
          </header>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <label>
              <span className="field-label">Thời gian được phép đi muộn</span>
              <div className="relative"><input className="field pr-14" placeholder="Chưa cấu hình" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">phút</span></div>
            </label>
            <label>
              <span className="field-label">Thời hạn quét sau giờ bắt đầu</span>
              <div className="relative"><input className="field pr-14" placeholder="Chưa cấu hình" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">phút</span></div>
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Nguồn quét được chấp nhận</span>
              <select className="field"><option>Android NFC và trình mô phỏng Web</option><option>Chỉ thiết bị Android đã phê duyệt</option></select>
            </label>
            <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" /> Kiểm tra toàn vẹn đang bật</p>
              <p className="mt-1 text-[11px] leading-5 text-emerald-700">UID thẻ được chuẩn hóa và băm HMAC-SHA256 trước khi đối chiếu dữ liệu.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
