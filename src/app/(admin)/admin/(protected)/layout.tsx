import { requireAdminPage } from '@/lib/auth/session';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();

  return <AdminShell user={user}>{children}</AdminShell>;
}
