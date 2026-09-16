'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminT } from '@/components/admin/i18n-provider';

const controlClasses =
  'block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:border-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-500/30';

interface FilterValues {
  q: string;
  type: string;
  slot: string;
  sort: string;
}

/**
 * 列表筛选器：全部条件通过 URL 查询参数驱动（可分享、可后退）。
 * 任意筛选变化都会重置 `page`，回到第一页。
 */
export function MediaFilters({
  q,
  type,
  slot,
  sort,
  slotOptions,
}: {
  q: string;
  type: string;
  slot: string;
  sort: string;
  slotOptions: { value: string; label: string }[];
}) {
  const t = useAdminT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function current(): FilterValues {
    const form = formRef.current;
    if (!form) return { q, type, slot, sort };
    const data = new FormData(form);
    return {
      q: String(data.get('q') ?? q),
      type: String(data.get('type') ?? type),
      slot: String(data.get('slot') ?? slot),
      sort: String(data.get('sort') ?? sort),
    };
  }

  function navigate(patch: Partial<FilterValues>) {
    const values = { ...current(), ...patch };
    const params = new URLSearchParams();
    const query = values.q.trim();
    if (query) params.set('q', query);
    if (values.type !== 'all') params.set('type', values.type);
    if (values.slot !== 'all') params.set('slot', values.slot);
    if (values.sort !== 'newest') params.set('sort', values.sort);
    const search = params.toString();
    router.push(search ? `/admin/media?${search}` : '/admin/media');
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ q: current().q });
      }}
      className="grid gap-3 rounded-xl border border-navy-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="media-search" className="sr-only">
          {t.media.searchPlaceholder}
        </label>
        <input
          key={q}
          id="media-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.media.searchPlaceholder}
          className={controlClasses}
        />
      </div>

      <select
        key={`type-${type}`}
        name="type"
        defaultValue={type}
        aria-label={t.media.colType}
        onChange={(event) => navigate({ type: event.target.value })}
        className={controlClasses}
      >
        <option value="all">{t.media.filterAllTypes}</option>
        <option value="image">{t.media.filterImages}</option>
        <option value="video">{t.media.filterVideos}</option>
      </select>

      <select
        key={`slot-${slot}`}
        name="slot"
        defaultValue={slot}
        aria-label={t.media.colSlots}
        onChange={(event) => navigate({ slot: event.target.value })}
        className={controlClasses}
      >
        <option value="all">{t.media.filterAllSlots}</option>
        <option value="unbound">{t.media.filterUnbound}</option>
        {slotOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        key={`sort-${sort}`}
        name="sort"
        defaultValue={sort}
        aria-label={t.media.colUpdated}
        onChange={(event) => navigate({ sort: event.target.value })}
        className={controlClasses}
      >
        <option value="newest">{`${t.media.colUpdated} ↓`}</option>
        <option value="oldest">{`${t.media.colUpdated} ↑`}</option>
        <option value="name">{t.media.colName}</option>
      </select>

      {/* 回车提交用：隐藏的默认提交按钮（选项变化即时筛选） */}
      <button type="submit" className="hidden" tabIndex={-1}>
        {t.media.searchPlaceholder}
      </button>
    </form>
  );
}
