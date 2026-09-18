import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { getBlockLabel } from '@/lib/admin/labels';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { loadPageDraftState } from '@/lib/admin/page-draft-store';
import { planSync } from '@/lib/translation/state';
import { locales } from '@/lib/i18n/config';
import { readPageDraft, type PageDraft } from '@/lib/page-draft';
import { PageForm, type PageFormValues } from './page-form';
import { PageStatusForm } from './page-status-form';
import { BlockForm, type BlockFormValues } from './block-form';
import { PageTranslateButton, type PageFormRef } from './page-translate-button';
import { PageVersions, type PageVersionRow } from './page-versions';

export const dynamic = 'force-dynamic';

/**
 * 页面编辑器（首页也是普通页面，只是 `isHome` 为真）。
 *
 * 与商品编辑器同一套两段式：读的是**正在编辑的内容**（有草稿就是草稿，
 * 没有就是线上内容），保存写草稿，发布才写线上并留一版。
 *
 * 「语言同步」这一栏直接调 `planSync` —— 与真正执行同步时用的是同一个判断，
 * 所以这里显示「都已是最新」就是真的最新，点同步不会突然翻出一堆字段。
 */
export default async function AdminPageDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const { t } = await getAdminMessagesForRequest();

  const db = tryDb((value) => loadPageDraftState(value, id));
  const state = await db;

  if (state === null) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.pageDetail.dbUnavailable}</Alert>
        <Link href="/admin/pages" className="text-sm text-copper-700 hover:underline">
          {t.pageDetail.back}
        </Link>
      </div>
    );
  }

  if (!state) notFound();

  const [plan, versions] = await Promise.all([
    tryDb((client) => planSync(client, 'page', id)),
    tryDb((client) =>
      client.pageVersion.findMany({
        where: { pageId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          note: true,
          snapshot: true,
          releaseId: true,
          createdAt: true,
          createdBy: { select: { email: true, name: true } },
        },
      }),
    ),
  ]);

  const { draft, hasDraft, published } = state;

  const pageTranslations = {} as PageFormValues['translations'];
  for (const locale of ADMIN_LOCALES) {
    pageTranslations[locale] = { ...draft.translations[locale] };
  }

  const blocks: BlockFormValues[] = draft.blocks.map((block) => {
    const translations = {} as BlockFormValues['translations'];
    for (const locale of ADMIN_LOCALES) {
      translations[locale] = { ...block.values[locale] };
    }
    return { id: block.id ?? `key:${block.key}`, key: block.key, enabled: block.enabled, translations };
  });

  // 需要保存的表单：页面信息一个 + 每个区块一个。
  // 一键翻译按这个顺序逐个提交，因此翻译读到的就是表单里的最新中文。
  const forms: PageFormRef[] = [
    { id: 'page-form', kind: 'page' },
    ...draft.blocks.flatMap((block) => (block.id ? [{ id: `block-form-${block.id}`, kind: 'block' as const }] : [])),
  ];

  const versionRows: PageVersionRow[] = (versions ?? []).map((row) => {
    const snapshot = readPageDraft(row.snapshot);
    return {
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      note: row.note,
      createdBy: row.createdBy?.name || row.createdBy?.email || null,
      snapshotTitle: snapshotTitle(snapshot),
      releaseId: row.releaseId,
    };
  });

  const counted = (plan?.locales ?? []).filter((item) => item.state !== 'empty');
  const pendingLocales = counted.filter((item) => item.state !== 'synced').length;
  const failedLocales = counted.filter((item) => item.state === 'failed').length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/pages" className="text-sm text-copper-700 hover:underline">
          {t.pageDetail.back}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-navy-900">
          {draft.translations.zh.title || draft.slug}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted">{draft.slug}</p>
      </div>

      {hasDraft ? (
        <Alert kind="info">
          <span className="font-medium">{t.pageDetail.pendingTitle}</span>
          {' — '}
          {t.pageDetail.pendingHint}
        </Alert>
      ) : null}

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t.pageDetail.publishStatus}</h2>
        <PageStatusForm id={id} status={published ? 'PUBLISHED' : 'DRAFT'} />
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.pageDetail.syncStatus}</h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="text-muted">
            {t.pageDetail.revisionLabel}{' '}
            <span className="font-mono text-navy-700">
              {formatMessage(t.sync.revisionValue, { revision: plan?.revision ?? 0 })}
            </span>
          </span>
          {plan?.changed ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
              {t.sync.revisionChanged}
            </span>
          ) : null}
          <span className={failedLocales > 0 ? 'text-copper-700' : pendingLocales > 0 ? 'text-amber-700' : 'text-emerald-700'}>
            {failedLocales > 0
              ? formatMessage(t.pageDetail.syncFailed, { count: failedLocales })
              : pendingLocales > 0
                ? formatMessage(t.pageDetail.syncPending, { count: pendingLocales })
                : t.pageDetail.syncReady}
          </span>
          <Link href="/admin/sync" className="ml-auto text-copper-700 hover:underline">
            {t.sync.title} →
          </Link>
        </div>

        <PageTranslateButton
          pageId={id}
          forms={forms}
          targetCount={locales.length - 1}
        />
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">{t.pageDetail.pageInformation}</h2>
        <PageForm values={{ id, slug: draft.slug, translations: pageTranslations }} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-navy-900">
          {formatMessage(t.pageDetail.blocks, { count: blocks.length })}
        </h2>
        {blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            {t.pageDetail.noBlocksBefore}
            <code>npm run db:seed</code>
            {t.pageDetail.noBlocksAfter}
          </p>
        ) : (
          blocks.map((block) => (
            <details key={block.id} className="rounded-xl border border-navy-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
                <span className="font-medium text-navy-900">{getBlockLabel(t, block.key)}</span>
                <span className="font-mono text-xs text-navy-500">{block.key}</span>
                <span
                  className={
                    block.enabled
                      ? 'ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                      : 'ml-auto rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                  }
                >
                  {block.enabled ? t.common.visible : t.common.hidden}
                </span>
              </summary>
              <div className="border-t border-navy-100 px-5 py-5">
                <BlockForm values={block} />
              </div>
            </details>
          ))
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-navy-900">{t.pageDetail.versions}</h2>
        <PageVersions pageId={id} versions={versionRows} />
      </section>
    </div>
  );
}

/** 版本列表里显示的中文标题：优先中文，其次随便取一个非空的 */
function snapshotTitle(snapshot: PageDraft | null): string {
  if (!snapshot) return '';
  const zh = snapshot.translations.zh?.title?.trim();
  if (zh) return zh;
  for (const locale of ADMIN_LOCALES) {
    const title = snapshot.translations[locale]?.title?.trim();
    if (title) return title;
  }
  return '';
}
