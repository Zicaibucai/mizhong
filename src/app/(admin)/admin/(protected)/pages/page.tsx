import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { getPageStatusLabel } from '@/lib/admin/labels';
import { Alert } from '@/components/admin/form';

export const dynamic = 'force-dynamic';

export default async function AdminPagesListPage() {
  await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  const pages = await tryDb((db) =>
    db.page.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { translations: true, _count: { select: { blocks: true } } },
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.pages.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.pages.subtitle}</p>
      </header>

      {pages === null ? <Alert kind="error">{t.pages.dbUnavailable}</Alert> : null}

      {pages?.length === 0 ? (
        <Alert kind="info">
          {t.pages.noDataBefore}
          <code>npm run db:seed</code>
          {t.pages.noDataAfter}
        </Alert>
      ) : null}

      {pages?.length ? (
        <div className="overflow-hidden rounded-xl border border-navy-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-xs uppercase tracking-wide text-navy-600">
              <tr>
                <th className="px-5 py-3 font-medium">{t.pages.colPage}</th>
                <th className="px-5 py-3 font-medium">{t.pages.colSlug}</th>
                <th className="px-5 py-3 font-medium">{t.pages.colBlocks}</th>
                <th className="px-5 py-3 font-medium">{t.pages.colStatus}</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {pages.map((page) => (
                <tr key={page.id}>
                  <td className="px-5 py-3.5 font-medium text-navy-900">
                    {page.translations.find((tr) => tr.locale === 'zh')?.title ??
                      page.translations[0]?.title ??
                      t.common.untitled}
                    {page.isHome ? (
                      <span className="ml-2 rounded-full bg-copper-100 px-2 py-0.5 text-xs text-copper-700">
                        {t.pages.home}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-navy-600">{page.slug}</td>
                  <td className="px-5 py-3.5 text-navy-600">{page._count.blocks}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={
                        page.status === 'PUBLISHED'
                          ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                          : 'rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700'
                      }
                    >
                      {getPageStatusLabel(t, page.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/admin/pages/${page.id}`}
                      className="text-sm text-copper-700 hover:underline"
                    >
                      {t.common.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
