import Link from 'next/link';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';

/** 素材已被删除（或 id 不存在）时展示，避免出现无文案的空白 404 */
export default async function MediaNotFound() {
  const { t } = await getAdminMessagesForRequest();

  return (
    <div className="space-y-4">
      <Alert kind="error">{t.media.notFound}</Alert>
      <Link href="/admin/media" className="text-sm text-copper-700 hover:underline">
        ← {t.media.title}
      </Link>
    </div>
  );
}
