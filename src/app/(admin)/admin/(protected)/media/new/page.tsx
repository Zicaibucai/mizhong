import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { MediaUploader } from '@/components/admin/media/media-uploader';

export const dynamic = 'force-dynamic';

export default async function AdminMediaNewPage() {
  await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/media" className="text-sm text-copper-700 hover:underline">
          ← {t.media.title}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-navy-900">
          {t.media.newTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">{t.media.newSubtitle}</p>
      </div>

      <MediaUploader />
    </div>
  );
}
