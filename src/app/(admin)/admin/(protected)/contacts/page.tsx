import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { getContactTypeLabel } from '@/lib/admin/labels';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteContactAction } from '@/lib/admin/actions/contacts';
import { ContactForm, type ContactValues } from './contact-form';

export const dynamic = 'force-dynamic';

export default async function AdminContactsPage() {
  await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  const rows = await tryDb((db) =>
    db.contactMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { translations: true },
    }),
  );

  const contacts: (ContactValues & { id: string })[] = (rows ?? []).map((row) => {
    const translations = {} as Record<AdminLocale, { label: string; value: string }>;
    for (const locale of ADMIN_LOCALES) {
      const tr = row.translations.find((item) => item.locale === locale);
      translations[locale] = { label: tr?.label ?? '', value: tr?.value ?? '' };
    }
    return {
      id: row.id,
      type: row.type,
      value: row.value ?? '',
      href: row.href ?? '',
      sortOrder: row.sortOrder,
      enabled: row.enabled,
      translations,
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.contacts.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.contacts.subtitle}</p>
      </header>

      {rows === null ? <Alert kind="error">{t.contacts.dbUnavailable}</Alert> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-navy-900">
          {formatMessage(t.contacts.existing, { count: contacts.length })}
        </h2>
        {contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.contacts.empty}
          </p>
        ) : (
          contacts.map((contact) => (
            <details key={contact.id} className="rounded-xl border border-navy-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
                <span className="font-medium text-navy-900">
                  {getContactTypeLabel(t, contact.type)}
                </span>
                <span className="text-navy-600">{contact.value || t.contacts.noSharedValue}</span>
                <span
                  className={
                    contact.enabled
                      ? 'ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                      : 'ml-auto rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                  }
                >
                  {contact.enabled ? t.common.enabled : t.common.disabled}
                </span>
                <span className="text-xs text-muted">
                  {formatMessage(t.common.orderValue, { order: contact.sortOrder })}
                </span>
              </summary>
              <div className="space-y-4 border-t border-navy-100 px-5 py-5">
                <ContactForm contact={contact} submitLabel={t.common.saveChanges} />
                <div className="border-t border-navy-100 pt-4">
                  <DeleteForm
                    action={deleteContactAction}
                    id={contact.id}
                    confirmText={t.contacts.deleteConfirm}
                  />
                </div>
              </div>
            </details>
          ))
        )}
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.contacts.addTitle}</h2>
        <div className="mt-4">
          <ContactForm submitLabel={t.common.add} />
        </div>
      </section>
    </div>
  );
}
