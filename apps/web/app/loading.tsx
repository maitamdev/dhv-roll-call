export default function RootLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-3 text-center">
        <div className="skeleton mx-auto h-12 w-12 rounded-2xl" />
        <div className="skeleton mx-auto h-4 w-48" />
        <div className="skeleton mx-auto h-3 w-64" />
      </div>
    </div>
  );
}
