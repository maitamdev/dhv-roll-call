export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Đang tải dữ liệu">
      <div className="skeleton h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-3"><div className="skeleton h-28" /><div className="skeleton h-28" /><div className="skeleton h-28" /></div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]"><div className="skeleton h-80" /><div className="skeleton h-80" /></div>
    </div>
  );
}
