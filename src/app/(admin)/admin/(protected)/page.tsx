import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { isDbConfigured, tryDb } from '@/lib/db';
import { Alert } from '@/components/admin/form';
import { adminDateLocale, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { getAuditActionLabel } from '@/lib/admin/labels';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const { locale, t } = await getAdminMessagesForRequest();

  const stats = await tryDb(async (db) => {
    const [pages, published, drafts, products, assets, inquiries, recent] = await Promise.all([
      db.page.count(),
      db.page.count({ where: { status: 'PUBLISHED' } }),
      db.page.count({ where: { status: 'DRAFT' } }),
      db.product.count(),
      db.asset.count(),
      db.inquiry.count(),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          targetType: true,
          summary: true,
          actorEmail: true,
          createdAt: true,
        },
      }),
    ]);
    return { pages, published, drafts, products, assets, inquiries, recent };
  });

  const cards = [
    { label: t.dashboard.totalPages, value: stats?.pages },
    { label: t.dashboard.publishedPages, value: stats?.published },
    { label: t.dashboard.draftPages, value: stats?.drafts },
    { label: t.dashboard.products, value: stats?.products },
    { label: t.dashboard.assets, value: stats?.assets },
    { label: t.dashboard.inquiries, value: stats?.inquiries },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.dashboard.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.dashboard.subtitle}</p>
      </header>

      {!isDbConfigured() ? (
        <Alert kind="error">
          {t.dashboard.dbMissingBefore}
          <code>DATABASE_URL</code>
          {t.dashboard.dbMissingAfter}
        </Alert>
      ) : !stats ? (
        <Alert kind="error">{t.dashboard.dbUnavailable}</Alert>
      ) : null}

      <section
        aria-label={t.dashboard.statistics}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-navy-200 bg-white p-5">
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-900">
              {card.value ?? '—'}
            </p>
          </div>
        ))}
      </section>

      <section
        aria-label={t.dashboard.recentActivity}
        className="rounded-xl border border-navy-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-navy-900">{t.dashboard.recentActivity}</h2>
          <Link href="/admin/audit" className="text-sm text-copper-700 hover:underline">
            {t.dashboard.viewAll}
          </Link>
        </div>
        {stats?.recent.length ? (
          <ul className="divide-y divide-navy-100">
            {stats.recent.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-20 shrink-0 font-medium text-navy-800">
                  {getAuditActionLabel(t, entry.action)}
                </span>
                <span className="text-navy-700">{entry.summary ?? entry.targetType}</span>
                <span className="ml-auto text-xs text-muted">
                  {entry.actorEmail ?? '—'} · {entry.createdAt.toLocaleString(adminDateLocale(locale))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">{t.dashboard.noActivity}</p>
        )}
      </section>
    </div>
  );
}
