'use client';

import { useState } from 'react';
import type { ProductVariantGroupView } from '@/lib/catalog';
import { cn } from '@/lib/cn';

/** 1688-style product option cards: one thumbnail and label per selectable model/colour. */
export function ProductVariantSelector({ groups }: { groups: ProductVariantGroupView[] }) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      groups.flatMap((group) => (group.options[0] ? [[group.id, group.options[0].id]] : [])),
    ),
  );

  if (groups.length === 0) return null;

  return (
    <div className="mt-6 space-y-5 border-b border-navy-200 pb-6">
      {groups.map((group) => (
        <fieldset key={group.id}>
          <legend className="mb-2.5 text-sm font-medium text-navy-700">{group.label}</legend>
          <div className="flex flex-wrap gap-2.5">
            {group.options.map((option) => {
              const active = selected[group.id] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelected((current) => ({ ...current, [group.id]: option.id }))
                  }
                  className={cn(
                    'relative flex min-h-14 max-w-full items-center gap-2 rounded-md border bg-white p-1.5 pr-3 text-left text-sm text-navy-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500',
                    active
                      ? 'border-copper-600 text-copper-800 shadow-[inset_0_0_0_1px_rgb(180_83_9)]'
                      : 'border-navy-200 hover:border-copper-400',
                  )}
                >
                  {option.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- media-library URLs use a dynamic OSS host
                    <img
                      src={option.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-11 w-11 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 break-words leading-snug">{option.label}</span>
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute -bottom-px -right-px flex h-4 w-4 items-center justify-center rounded-tl bg-copper-700 text-[9px] text-white"
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
