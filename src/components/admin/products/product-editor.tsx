'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useAdminLocale, useAdminT } from '@/components/admin/i18n-provider';
import { ProductTabs, TabPanel, type TabDef } from './tabs';
import { ProductActionBar } from './product-action-bar';
import { BasicTab } from './basic-tab';
import { PricingTab } from './pricing-tab';
import { TranslationsTab } from './translations-tab';
import { SpecsTab } from './specs-tab';
import { MediaTab } from './media-tab';
import { SeoTab } from './seo-tab';
import type { ProductEditorData } from './types';

/**
 * 商品编辑器：吸顶操作栏（保存 / 发布 / 预览）+ 六个分页。
 *
 * 六个分页属于**同一个商品编辑器**，共用一份 product id，切换分页不会丢未保存的输入
 * （每个面板保持挂载，见 `ProductTabs`），离开页面前有未保存提醒。
 * 「保存草稿」由操作栏按当前分页的 form id 提交，因此保存的永远是用户正在编辑的那一段。
 */
export function ProductEditor({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [dirty, setDirtyState] = useState<Record<string, boolean>>({});

  const setDirty = useCallback((tab: string, isDirty: boolean) => {
    setDirtyState((current) =>
      current[tab] === isDirty ? current : { ...current, [tab]: isDirty },
    );
  }, []);

  const anyDirty = Object.values(dirty).some(Boolean);

  /** In-app navigation guard: the beforeunload listener in ProductTabs handles full page loads. */
  const guardNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (anyDirty && !window.confirm(t.products.unsavedWarning)) event.preventDefault();
  };

  const tabs = useMemo<TabDef[]>(
    () => [
      { id: 'basic', label: t.products.tabBasic },
      { id: 'pricing', label: t.products.tabPricing },
      { id: 'translations', label: t.products.tabTranslations },
      { id: 'specs', label: t.products.tabSpecs },
      { id: 'media', label: t.products.tabMedia },
      { id: 'seo', label: t.products.tabSeo },
    ],
    [t],
  );

  const name =
    data.translations[locale].name ||
    data.translations.en.name ||
    data.translations.zh.name ||
    data.product.slug;

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

      <ProductTabs tabs={tabs} dirty={dirty} setDirty={setDirty}>
        <ProductActionBar data={data} />

        <TabPanel id="basic">
          <BasicTab data={data} />
        </TabPanel>
        <TabPanel id="pricing">
          <PricingTab data={data} />
        </TabPanel>
        <TabPanel id="translations">
          <TranslationsTab data={data} />
        </TabPanel>
        <TabPanel id="specs">
          <SpecsTab data={data} />
        </TabPanel>
        <TabPanel id="media">
          <MediaTab data={data} />
        </TabPanel>
        <TabPanel id="seo">
          <SeoTab data={data} />
        </TabPanel>
      </ProductTabs>
    </div>
  );
}
