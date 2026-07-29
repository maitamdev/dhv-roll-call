import { requirePageRole } from '@/lib/auth';

export default async function BiometricsAdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['ADMIN', 'TRAINING_OFFICE']);
  return children;
}
