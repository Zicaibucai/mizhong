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
 * 离开前的确认使用 `t.products.unsavedWarning`（「当前有未保存的修改，确定离开并放弃这些修改吗？」），
 * 而不是通用按钮文案 —— 提示语必须说清后果。
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
 * 当前激活的分页 id。
 *
 * 顶部操作栏的「保存草稿」用它拼出 `form="product-form-<tab>"`，
 * 直接提交**当前正在看的那一个表单** —— 不需要把六个表单合并成一个大表单，
 * 也不会误提交用户没在编辑的分区。
 */
export function useActiveTab(): string {
  const context = useContext(TabsContext);
  return context?.active ?? '';
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
  initialTab,
  children,
}: {
  tabs: TabDef[];
  dirty: Record<string, boolean>;
  setDirty: (tab: string, isDirty: boolean) => void;
  /** 首次渲染时打开的分区（默认第一个）。URL 带 #hash 时以 hash 为准 */
  initialTab?: string;
  children: ReactNode;
}) {
  const t = useAdminT();
  const firstTab = tabs[0]?.id ?? '';
  const [active, setActive] = useState(
    initialTab && tabs.some((tab) => tab.id === initialTab) ? initialTab : firstTab,
  );

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
    if (anyDirty && !window.confirm(t.products.unsavedWarning)) return;
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
