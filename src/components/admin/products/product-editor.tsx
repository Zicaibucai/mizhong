'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useAdminLocale, useAdminT } from '@/components/admin/i18n-provider';
import { ProductTabs, TabPanel, type SaveStatus, type TabDef } from './tabs';
import { ProductActionBar } from './product-action-bar';
import { VersionsTab } from './versions-tab';
import { VisualProductEditor } from './visual-product-editor';
import type { ProductEditorData } from './types';

/**
 * 商品编辑器：吸顶操作栏（保存状态 / 发布 / 预览）+ 可视化编辑 / 版本控制。
 *
 * 商品内容集中在一张可视化页面中，多语言、媒体、规格表与 SEO 不再拆成重复分页；
 * 版本历史保留为独立入口。
 *
 * 改动会在停止输入 1.5 秒后自动保存进**草稿**，所以切分页、离开页面都不再需要确认弹窗。
 * 只有**保存失败**时才重新武装离开提醒 —— 那时确实有改动没存下去，
 * 提醒才有意义（见 `ProductTabs` 里的 `hasFailed`）。
 */
export function ProductEditor({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});

  const reportStatus = useCallback((tab: string, status: SaveStatus) => {
    setStatuses((current) => (current[tab] === status ? current : { ...current, [tab]: status }));
  }, []);

  const hasFailed = Object.values(statuses).some((status) => status === 'error');

  /** 应用内跳转拦截。整页离开交给 ProductTabs 里的 beforeunload。 */
  const guardNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (hasFailed && !window.confirm(t.products.unsavedWarning)) event.preventDefault();
  };

  const tabs = useMemo<TabDef[]>(
    () => [
      { id: 'visual', label: t.products.tabVisual },
      { id: 'versions', label: t.products.tabVersions },
    ],
    [t],
  );

  // 名称回退顺序：后台界面语言 → 英文 → 中文 → 越南语 → 「未命名商品」。
  // 直接把 slug（可能只是 "2"）当标题显示，会让人以为商品没有名字。
  const name =
    data.translations[locale].name ||
    data.translations.en.name ||
    data.translations.zh.name ||
    data.translations.vi.name ||
    t.products.unnamedProduct;

  // 刚从「新建商品」进来、还什么都没有的草稿：给一句「先做什么」的引导，
  // 否则一屏空分区会让人不知道从哪下手
  const isFreshDraft =
    !data.product.published &&
    !data.product.coverAssetId &&
    data.media.length === 0 &&
    !data.translations.zh.name &&
    !data.translations.en.name &&
    !data.translations.vi.name;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          onClick={guardNavigation}
          className="text-sm text-copper-700 hover:underline"
        >
          ← {t.products.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{name}</h1>
          <span className="font-mono text-xs text-muted">{data.product.slug}</span>
        </div>
      </div>

      {isFreshDraft ? (
        <p className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm leading-relaxed text-navy-700">
          {t.products.emptyDraftHint}
        </p>
      ) : null}

      {/* 空草稿直接打开可视化编辑：名称、媒体、价格和详情都在同一张页面上 */}
      <ProductTabs
        tabs={tabs}
        statuses={statuses}
        onReportStatus={reportStatus}
        initialTab={isFreshDraft ? 'visual' : undefined}
      >
        <ProductActionBar
          data={data}
          saveFormIds={[
            'product-form-visual',
            'product-form-visual-specs',
            'product-form-visual-seo',
          ]}
        />

        <TabPanel id="visual">
          <VisualProductEditor data={data} />
        </TabPanel>

        <TabPanel id="versions">
          <VersionsTab data={data} />
        </TabPanel>
      </ProductTabs>
    </div>
  );
}
