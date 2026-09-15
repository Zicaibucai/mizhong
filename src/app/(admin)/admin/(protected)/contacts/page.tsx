import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { CONTACT_TYPE_LABELS } from '@/lib/admin/labels';
import { Alert } from '@/components/admin/form';
import { DeleteForm } from '@/components/admin/delete-form';
import { deleteContactAction } from '@/lib/admin/actions/contacts';
import { ContactForm, type ContactValues } from './contact-form';

export const dynamic = 'force-dynamic';

export default async function AdminContactsPage() {
  await requireAdminPage();

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
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">联系方式</h1>
        <p className="mt-1 text-sm text-muted">
          仅「启用」且填写了值的联系方式会展示在前台。未填写时前台不显示任何占位联系方式。
        </p>
      </header>

      {rows === null ? (
        <Alert kind="error">数据库不可用，无法读取联系方式。请检查 DATABASE_URL 与数据库服务。</Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-navy-900">
          已有联系方式（{contacts.length}）
        </h2>
        {contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            暂无联系方式。添加后前台才会展示。
          </p>
        ) : (
          contacts.map((contact) => (
            <details key={contact.id} className="rounded-xl border border-navy-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
                <span className="font-medium text-navy-900">
                  {CONTACT_TYPE_LABELS[contact.type] ?? contact.type}
                </span>
                <span className="text-navy-600">{contact.value || '（未填写通用值）'}</span>
                <span
                  className={
                    contact.enabled
                      ? 'ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                      : 'ml-auto rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                  }
                >
                  {contact.enabled ? '已启用' : '已停用'}
                </span>
                <span className="text-xs text-muted">排序 {contact.sortOrder}</span>
              </summary>
              <div className="space-y-4 border-t border-navy-100 px-5 py-5">
                <ContactForm contact={contact} submitLabel="保存修改" />
                <div className="border-t border-navy-100 pt-4">
                  <DeleteForm
                    action={deleteContactAction}
                    id={contact.id}
                    confirmText="确认删除该联系方式？前台将立即不再展示。"
                  />
                </div>
              </div>
            </details>
          ))
        )}
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">新增联系方式</h2>
        <div className="mt-4">
          <ContactForm submitLabel="新增" />
        </div>
      </section>
    </div>
  );
}
