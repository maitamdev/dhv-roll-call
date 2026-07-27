import { Nfc } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-white border border-border shadow-sm rounded-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Nfc className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">DHV TapAttend</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Hệ thống điểm danh sinh viên chuyên nghiệp
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
