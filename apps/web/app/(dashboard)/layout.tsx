import DashboardShell from '@/components/DashboardShell';
import { requirePageRole } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageRole(['ADMIN', 'TRAINING_OFFICE', 'LECTURER']);
  return (
    <DashboardShell>{children}</DashboardShell>
  );
}
