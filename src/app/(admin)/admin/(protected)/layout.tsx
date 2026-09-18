import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { AdminShell } from '@/components/admin/admin-shell';
import { listPendingEmergencies } from '@/lib/admin/pending-translation';

export const dynamic = 'force-dynamic';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();

  /**
   * 「多语言待同步」的常驻提示。
   *
   * 放在布局里，因此**后台每一页都会显示**，而不是只在出事的那条内容的编辑器里 ——
   * 应急发布是罕见的、需要有人跟进的状态，藏在某一页里等于没人会看到。
   * 查询本身很便宜：没有应急发布记录时就是一次查询。
   */
  const pending = await tryDb((db) => listPendingEmergencies(db));

  return (
    <AdminShell user={user} pendingTranslations={pending?.length ?? 0}>
      {children}
    </AdminShell>
  );
}
