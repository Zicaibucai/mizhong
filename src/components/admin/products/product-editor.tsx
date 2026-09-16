'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useAdminLocale, useAdminT } from '@/components/admin/i18n-provider';
import { cn } from '@/lib/cn';
import { ProductTabs, TabPanel, type TabDef } from './tabs';
import { BasicTab } from './basic-tab';
import { TranslationsTab } from './translations-tab';
import { MediaTab } from './media-tab';
import { SeoTab } from './seo-tab';
import type { ProductEditorData } from './types';

/**
 * The product editor: header (name, publish badge, public preview) plus the four tabs.
 *
 * The tab bodies live in sibling modules; every panel stays mounted so unsaved edits survive a
 * tab switch (see `ProductTabs`).
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
    if (anyDirty && !window.confirm(t.common.saveChanges)) event.preventDefault();
  };

  const tabs = useMemo<TabDef[]>(
    () => [
      { id: 'basic', label: t.products.tabBasic },
      { id: 'translations', label: t.products.tabTranslations },
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
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs',
              data.product.published
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            {data.product.published ? t.products.statusPublished : t.products.statusDraft}
          </span>
          <span className="font-mono text-xs text-muted">{data.product.slug}</span>
        </div>
      </div>

      <ProductTabs tabs={tabs} dirty={dirty} setDirty={setDirty}>
        <TabPanel id="basic">
          <BasicTab data={data} />
        </TabPanel>
        <TabPanel id="translations">
          <TranslationsTab data={data} />
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
