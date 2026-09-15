import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { blockLabel } from '@/lib/admin/labels';
import { Alert } from '@/components/admin/form';
import { PageForm, type PageFormValues } from './page-form';
import { PageStatusForm } from './page-status-form';
import { BlockForm, type BlockFormValues } from './block-form';

export const dynamic = 'force-dynamic';

export default async function AdminPageDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;

  const page = await tryDb((db) =>
    db.page.findUnique({
      where: { id },
      include: {
        translations: true,
        blocks: {
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
          include: { translations: true },
        },
      },
    }),
  );

  if (page === null) {
    return (
      <div className="space-y-4">
        <Alert kind="error">数据库不可用，无法读取该页面。</Alert>
        <Link href="/admin/pages" className="text-sm text-copper-700 hover:underline">
          ← 返回页面列表
        </Link>
      </div>
    );
  }

  if (!page) notFound();

  const pageTranslations = {} as PageFormValues['translations'];
  for (const locale of ADMIN_LOCALES) {
    const tr = page.translations.find((item) => item.locale === locale);
    pageTranslations[locale] = {
      title: tr?.title ?? '',
      seoTitle: tr?.seoTitle ?? '',
      seoDescription: tr?.seoDescription ?? '',
    };
  }

  const blocks: BlockFormValues[] = page.blocks.map((block) => {
    const translations = {} as BlockFormValues['translations'];
    for (const locale of ADMIN_LOCALES) {
      const tr = block.translations.find((item) => item.locale === locale);
      translations[locale] = {
        title: tr?.title ?? '',
        subtitle: tr?.subtitle ?? '',
        body: tr?.body ?? '',
        ctaLabel: tr?.ctaLabel ?? '',
        ctaHref: tr?.ctaHref ?? '',
      };
    }
    return { id: block.id, key: block.key, enabled: block.enabled, translations };
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/pages" className="text-sm text-copper-700 hover:underline">
          ← 返回页面列表
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-navy-900">
          {pageTranslations.zh.title || page.slug}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted">{page.slug}</p>
      </div>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">发布状态</h2>
        <PageStatusForm id={page.id} status={page.status} />
      </section>

      <section className="rounded-xl border border-navy-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">页面信息</h2>
        <PageForm values={{ id: page.id, slug: page.slug, translations: pageTranslations }} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-navy-900">页面区块（{blocks.length}）</h2>
        {blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-6 text-sm text-muted">
            该页面暂无区块。执行 <code>npm run db:seed</code> 可导入首页默认区块。
          </p>
        ) : (
          blocks.map((block) => (
            <details key={block.id} className="rounded-xl border border-navy-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
                <span className="font-medium text-navy-900">{blockLabel(block.key)}</span>
                <span className="font-mono text-xs text-navy-500">{block.key}</span>
                <span
                  className={
                    block.enabled
                      ? 'ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                      : 'ml-auto rounded-full bg-navy-100 px-2.5 py-0.5 text-xs text-navy-600'
                  }
                >
                  {block.enabled ? '显示中' : '已隐藏'}
                </span>
              </summary>
              <div className="border-t border-navy-100 px-5 py-5">
                <BlockForm values={block} />
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
