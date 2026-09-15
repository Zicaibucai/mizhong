import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteNavAction } from '@/lib/admin/actions/navigation';
import { NavForm, type NavValues } from './nav-form';

export const dynamic = 'force-dynamic';

export default async function AdminNavigationPage() {
  await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  const rows = await tryDb((db) =>
    db.navItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { translations: true },
    }),
  );

  const items: (NavValues & { id: string })[] = (rows ?? []).map((row) => {
    const translations = {} as Record<AdminLocale, { label: string }>;
    for (const locale of ADMIN_LOCALES) {
      const tr = row.translations.find((item) => item.locale === locale);
      translations[locale] = { label: tr?.label ?? '' };
    }
    return {
      id: row.id,
      href: row.href,
      external: row.external,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
      translations,
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.navigation.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.navigation.subtitle}</p>
      </header>

      {rows === null ? <Alert kind="error">{t.navigation.dbUnavailable}</Alert> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-navy-900">
          {formatMessage(t.navigation.existing, { count: items.length })}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.navigation.empty}
          </p>
        ) : (
          items.map((item) => (
            <details key={item.id} className="rounded-xl border border-navy-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
                <span className="font-medium text-navy-900">
                  {item.translations.zh.label || item.translations.en.label || t.common.untitled}
                </span>
                <span className="font-mono text-xs text-navy-500">{item.href}</span>
                <span
                  className={
                    item.enabled
                      ? 'ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                      : 'ml-auto rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                  }
                >
                  {item.enabled ? t.common.enabled : t.common.disabled}
                </span>
                <span className="text-xs text-muted">
                  {formatMessage(t.common.orderValue, { order: item.sortOrder })}
                </span>
              </summary>
              <div className="space-y-4 border-t border-navy-100 px-5 py-5">
                <NavForm item={item} submitLabel={t.common.saveChanges} />
                <div className="border-t border-navy-100 pt-4">
                  <DeleteForm
                    action={deleteNavAction}
                    id={item.id}
                    confirmText={t.navigation.deleteConfirm}
                  />
                </div>
              </div>
            </details>
          ))
        )}
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.navigation.addTitle}</h2>
        <div className="mt-4">
          <NavForm submitLabel={t.common.add} />
        </div>
      </section>
    </div>
  );
}
