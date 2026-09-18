import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import type { AdminLocale } from '@/lib/admin/validation';
import { listRecentJobs } from '@/lib/translation/jobs';
import { loadSyncOverview, totalsOf } from '@/lib/admin/sync-overview';
import { contentTypeLabel, describeJobError, jobStatusLabel, syncStateLabel } from '@/lib/admin/publish-sync';
import { SyncControls, SyncOneButton } from './sync-controls';

export const dynamic = 'force-dynamic';

/**
 * 语言同步中心。
 *
 * 回答一个问题：**中文改过之后，各语言同步到了什么程度。**
 * 每一行的状态由 `planSync` 现场算出（与真正同步时同一个函数），
 * 所以这里显示「已是最新」就是真的最新，点同步不会突然翻出一堆字段。
 */
export default async function AdminSyncPage() {
  await requireAdminPage();
  const { t, locale } = await getAdminMessagesForRequest();

  const [rows, jobs] = await Promise.all([
    tryDb((db) => loadSyncOverview(db)),
    tryDb((db) => listRecentJobs(db, 8)),
  ]);

  if (rows === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.sync.title}</h1>
        <Alert kind="error">{t.sync.dbUnavailable}</Alert>
      </div>
    );
  }

  const totals = totalsOf(rows);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{t.sync.title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{t.sync.subtitle}</p>
      </div>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <SyncControls initial={null} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t.sync.colContent} value={String(totals.entities)} />
        <Stat label={t.sync.colPending} value={String(totals.pending)} tone={totals.pending > 0 ? 'warn' : 'ok'} />
        <Stat label={t.sync.colFailed} value={String(totals.failed)} tone={totals.failed > 0 ? 'bad' : 'ok'} />
      </section>

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.sync.empty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-navy-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-navy-100 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.sync.colContent}</th>
                  <th className="px-4 py-3 font-medium">{t.sync.colType}</th>
                  <th className="px-4 py-3 font-medium">{t.sync.colRevision}</th>
                  <th className="px-4 py-3 font-medium">{t.sync.colSynced}</th>
                  <th className="px-4 py-3 font-medium">{t.sync.colPending}</th>
                  <th className="px-4 py-3 font-medium">{t.sync.colStatus}</th>
                  <th className="px-4 py-3 font-medium">{t.sync.colLastSynced}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const failed = row.failedLocales;
                  const pending = row.pendingLocales - failed;
                  return (
                    <tr key={`${row.entityType}-${row.entityId}`} className="border-b border-navy-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          {row.editHref ? (
                            <Link href={row.editHref} className="font-medium text-navy-900 hover:underline">
                              {row.label}
                            </Link>
                          ) : (
                            <span className="font-medium text-navy-900">{row.label}</span>
                          )}
                          {row.hint ? <span className="font-mono text-xs text-muted">{row.hint}</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {contentTypeLabel(row.entityType, t)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-mono text-navy-700">
                          {formatMessage(t.sync.revisionValue, { revision: row.revision })}
                        </span>
                        {row.changed ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                            {t.sync.revisionChanged}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {formatMessage(t.sync.countOf, {
                          done: row.syncedLocales,
                          total: row.totalLocales,
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {pending > 0 ? <span className="text-amber-700">{pending}</span> : <span className="text-muted">0</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {failed > 0 ? (
                          <span className="rounded-full bg-copper-50 px-2 py-0.5 text-copper-700">
                            {failed} {t.sync.colFailed}
                          </span>
                        ) : row.pendingLocales === 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                            {t.sync.stateSynced}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
                            {syncStateLabel(row.pendingLocales === row.totalLocales ? 'stale' : 'partial', t)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {row.lastSyncedAt ? formatWhen(row.lastSyncedAt, locale) : t.sync.neverSynced}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SyncOneButton entityType={row.entityType} entityId={row.entityId} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-navy-900">{t.sync.recentJobs}</h2>
        {!jobs || jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.sync.noJobs}
          </p>
        ) : (
          <ul className="divide-y divide-navy-50 rounded-xl border border-navy-200 bg-white">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-xs">
                <span className="font-medium text-navy-900">{jobStatusLabel(job.status, t)}</span>
                <span className="text-muted">
                  {formatMessage(t.sync.jobSummary, {
                    completed: job.completedItems,
                    total: job.totalItems,
                    failed: job.failedItems,
                  })}
                </span>
                <span className="text-muted">
                  {formatMessage(t.sync.jobRequests, { count: job.requestCount })}
                </span>
                <span className="text-muted">
                  {formatMessage(t.sync.jobTokens, { count: job.tokenEstimate })}
                </span>
                {job.lastError ? (
                  <span className="text-copper-700">{describeJobError(job.lastError, t)}</span>
                ) : null}
                <span className="ml-auto text-muted">{formatWhen(job.createdAt.toISOString(), locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'ok',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'bad' ? 'text-copper-700' : tone === 'warn' ? 'text-amber-700' : 'text-navy-900';
  return (
    <div className="rounded-xl border border-navy-200 bg-white px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

/** 后台界面只有中/英两种语言，与商品编辑器里的时间格式保持一致 */
function formatWhen(iso: string, locale: AdminLocale): string {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}
