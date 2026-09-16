'use client';

import { useRouter } from 'next/navigation';
import { Field, Select, TextInput } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * Search + category + status filters.
 *
 * Selects apply immediately; the search box applies on Enter (native form submit), so the filter
 * bar needs no extra submit label.
 */
export function ProductFilters({
  categories,
  q,
  categoryId,
  status,
}: {
  categories: { id: string; name: string }[];
  q: string;
  categoryId: string;
  status: string;
}) {
  const t = useAdminT();
  const router = useRouter();

  const apply = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const search = new URLSearchParams();
    for (const key of ['q', 'categoryId', 'status']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) search.set(key, value);
    }
    const query = search.toString();
    router.push(query ? `/admin/products?${query}` : '/admin/products');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        // Only selects auto-apply; typing in the search field waits for Enter.
        if ((event.target as HTMLElement).tagName === 'SELECT') apply(event.currentTarget);
      }}
      className="grid gap-3 rounded-xl border border-navy-200 bg-white p-4 sm:grid-cols-3"
    >
      <Field label={t.products.searchPlaceholder} htmlFor="product-q">
        <TextInput id="product-q" name="q" type="search" defaultValue={q} />
      </Field>
      <Field label={t.products.category} htmlFor="product-category">
        <Select
          id="product-category"
          name="categoryId"
          defaultValue={categoryId}
          options={[
            { value: '', label: t.products.allCategories },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
      </Field>
      <Field label={t.products.colStatus} htmlFor="product-status">
        <Select
          id="product-status"
          name="status"
          defaultValue={status}
          options={[
            { value: '', label: t.products.allStatuses },
            { value: 'published', label: t.products.statusPublished },
            { value: 'draft', label: t.products.statusDraft },
          ]}
        />
      </Field>
    </form>
  );
}
