import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { Alert } from '@/components/admin/form';
import { adminDateLocale, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { getAuditActionLabel } from '@/lib/admin/labels';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  await requireAdminPage();
  const { locale, t } = await getAdminMessagesForRequest();

  const entries = await tryDb((db) =>
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        summary: true,
        actorEmail: true,
        ip: true,
        createdAt: true,
      },
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.audit.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.audit.subtitle}</p>
      </header>

      {entries === null ? <Alert kind="error">{t.audit.dbUnavailable}</Alert> : null}

      {entries?.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
          {t.audit.empty}
        </p>
      ) : null}

      {entries?.length ? (
        <div className="overflow-x-auto rounded-xl border border-navy-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-xs uppercase tracking-wide text-navy-600">
              <tr>
                <th className="px-5 py-3 font-medium">{t.audit.colTime}</th>
                <th className="px-5 py-3 font-medium">{t.audit.colActor}</th>
                <th className="px-5 py-3 font-medium">{t.audit.colAction}</th>
                <th className="px-5 py-3 font-medium">{t.audit.colTarget}</th>
                <th className="px-5 py-3 font-medium">{t.audit.colSummary}</th>
                <th className="px-5 py-3 font-medium">{t.audit.colIp}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-navy-600">
                    {entry.createdAt.toLocaleString(adminDateLocale(locale))}
                  </td>
                  <td className="px-5 py-3 text-navy-700">{entry.actorEmail ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-700">
                      {getAuditActionLabel(t, entry.action)}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-navy-600">{entry.targetType}</td>
                  <td className="px-5 py-3 text-navy-800">{entry.summary ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-navy-500">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
