'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { useAdminT } from '@/components/admin/i18n-provider';
import type { FormState } from '@/lib/admin/action-state';

/**
 * Dirty-state plumbing for the product editor tabs.
 *
 * NOTE: the admin message catalog (src/lib/admin/messages/catalog.ts) is frozen for this
 * workstream and carries no dedicated "unsaved changes" string, so the switch-tab confirmation
 * reuses `t.common.saveChanges` — the closest existing way to say "you have edits pending".
 */

interface TabsContextValue {
  active: string;
  setActive: (tab: string) => void;
  setDirty: (tab: string, dirty: boolean) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabDef {
  id: string;
  label: string;
}

/** Marks a form's edits as pending; call `clearDirty()` once the save succeeded. */
export function useDirtyTracker(tab: string): { markDirty: () => void; clearDirty: () => void } {
  const context = useContext(TabsContext);
  const setDirty = context?.setDirty;

  const markDirty = useCallback(() => {
    setDirty?.(tab, true);
  }, [setDirty, tab]);

  const clearDirty = useCallback(() => {
    setDirty?.(tab, false);
  }, [setDirty, tab]);

  return useMemo(() => ({ markDirty, clearDirty }), [markDirty, clearDirty]);
}

/**
 * Convenience wrapper for a tab's form: pass the form's action state and spread the returned
 * `markDirty` onto the form's `onChange`; a successful save clears the pending marker.
 */
export function useDirtyForm(tab: string, state: FormState): { markDirty: () => void } {
  const { markDirty, clearDirty } = useDirtyTracker(tab);

  useEffect(() => {
    if (state.status === 'success') clearDirty();
  }, [state, clearDirty]);

  return { markDirty };
}

/**
 * Tab shell for the product editor (the URL hash drives the active tab, e.g. `#media`).
 *
 * Every panel stays mounted and is merely hidden, so unsaved field values survive a tab switch
 * and a save in one tab never wipes another. The dirty map is owned by the parent (so it can also
 * guard its own links): while anything is dirty a `beforeunload` guard protects against
 * navigation, and switching tabs asks for confirmation first.
 */
export function ProductTabs({
  tabs,
  dirty,
  setDirty,
  children,
}: {
  tabs: TabDef[];
  dirty: Record<string, boolean>;
  setDirty: (tab: string, isDirty: boolean) => void;
  children: ReactNode;
}) {
  const t = useAdminT();
  const firstTab = tabs[0]?.id ?? '';
  const [active, setActive] = useState(firstTab);

  const anyDirty = Object.values(dirty).some(Boolean);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (tabs.some((tab) => tab.id === hash)) setActive(hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [tabs]);

  useEffect(() => {
    if (!anyDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  const contextValue = useMemo<TabsContextValue>(
    () => ({ active, setActive, setDirty }),
    [active, setDirty],
  );

  const select = (id: string) => {
    if (id === active) return;
    if (anyDirty && !window.confirm(t.common.saveChanges)) return;
    setActive(id);
    // replaceState keeps the URL in sync without stacking history entries.
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div className="space-y-5">
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-navy-200 pb-px">
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                onClick={() => select(tab.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-t-lg px-4 py-2 text-sm transition-colors',
                  selected
                    ? 'border-b-2 border-copper-600 font-medium text-navy-900'
                    : 'border-b-2 border-transparent text-navy-600 hover:bg-navy-50',
                )}
              >
                {tab.label}
                {dirty[tab.id] ? (
                  <span aria-hidden className="ml-1 text-copper-600">
                    •
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {children}
      </div>
    </TabsContext.Provider>
  );
}

/** One tab body. Stays mounted; only the active one is visible. */
export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(TabsContext);
  const active = context?.active ?? id;
  const isActive = active === id;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!isActive}
      tabIndex={-1}
      className="space-y-5 focus:outline-none"
    >
      {children}
    </div>
  );
}
