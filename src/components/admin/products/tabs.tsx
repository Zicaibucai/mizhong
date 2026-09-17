'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import type { FormState } from '@/lib/admin/action-state';

/**
 * 商品编辑器的分区外壳 + 自动保存。
 *
 * **为什么不再有确认弹窗**：以前每次切分区、离开页面都会弹「当前有未保存的修改…」，
 * 因为那时保存完全靠手点。现在改动会在停止输入 1.5 秒后自动写进草稿，
 * 「未保存的修改」这个状态基本不存在了，那些确认框只会变成噪音，所以全部去掉。
 *
 * 唯一保留离开提醒的情况是**保存失败**（例如价格区间上下限填反）——
 * 那时提醒是有意义的：确实有改动没能存下去。
 */

/** 停止输入多久之后自动保存 */
const AUTOSAVE_DELAY_MS = 1500;

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface TabsContextValue {
  active: string;
  setActive: (tab: string) => void;
  statuses: Record<string, SaveStatus>;
  reportStatus: (tab: string, status: SaveStatus) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabDef {
  id: string;
  label: string;
}

/**
 * 把一个表单接上自动保存。
 *
 * 做法是**复用现有的 Server Action 与 `useActionState`**：只是在停止输入后调用
 * `form.requestSubmit()`，剩下的提交、校验、回显提示全部走原来那条路。
 * 因此不需要为自动保存另开一条保存通道，六个分区也仍然是六个独立表单
 * （合并成一个大表单反而会出现「改价格把多语言清空」那类互相覆盖的问题）。
 */
export function useAutoSaveForm(
  tab: string,
  formId: string,
  state: FormState,
  isPending: boolean,
  /**
   * `useActionState` 的 dispatch。
   *
   * 传进来是为了**自己接管提交**，而不是把 `action` 交给 `<form>`：
   * React 19 会在 `<form action={fn}>` 的动作完成后自动 reset 整个非受控表单，
   * 而 reset 用的是当前渲染里的 `defaultValue`。我们的 defaultValue 来自服务端数据，
   * 保存后并不会立刻更新 —— 于是「存完 → 表单被重置回旧值 → 下一次自动保存把旧值写回去」，
   * 表现为：改完名称再改描述，名称被清空。实测确认过。
   *
   * 改成在 `onSubmit` 里自己 `preventDefault()` 再派发动作，就没有这次自动 reset，
   * 输入框的 DOM 值（也就是用户真正在编辑的东西）不会被抹掉。
   */
  dispatch: (payload: FormData) => void,
): { status: SaveStatus; scheduleSave: () => void; formProps: { onSubmit: (event: FormEvent<HTMLFormElement>) => void } } {
  const context = useContext(TabsContext);
  const reportStatus = context?.reportStatus;
  const [waiting, setWaiting] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  /**
   * 安排一次自动保存。
   *
   * 除了表单事件，**程序化改动也要走它**：规格参数分区里「增加一条 / 删除 / 上移下移」
   * 改的是 React 状态，不会在表单上触发 input/change 事件，不主动调一次就永远不会保存。
   */
  const scheduleSave = useCallback(() => {
    setWaiting(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setWaiting(false);
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }, AUTOSAVE_DELAY_MS);
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    // `input` 覆盖文本输入，`change` 覆盖下拉、单选与复选框
    form.addEventListener('input', scheduleSave);
    form.addEventListener('change', scheduleSave);
    return () => {
      window.clearTimeout(timerRef.current);
      form.removeEventListener('input', scheduleSave);
      form.removeEventListener('change', scheduleSave);
    };
  }, [formId, scheduleSave]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      dispatch(new FormData(event.currentTarget));
    },
    [dispatch],
  );

  const status: SaveStatus = isPending
    ? 'saving'
    : waiting
      ? 'pending'
      : state.status === 'error'
        ? 'error'
        : state.status === 'success'
          ? 'saved'
          : 'idle';

  useEffect(() => {
    reportStatus?.(tab, status);
  }, [tab, status, reportStatus]);

  return { status, scheduleSave, formProps: { onSubmit } };
}

/**
 * 当前激活的分区 id。
 *
 * 顶部操作栏的「保存」用它拼出 `form="product-form-<tab>"`，
 * 直接提交**当前正在看的那一个表单**。
 */
export function useActiveTab(): string {
  const context = useContext(TabsContext);
  return context?.active ?? '';
}

/**
 * Tab shell for the product editor (the URL hash drives the active tab, e.g. `#media`).
 *
 * Every panel stays mounted and is merely hidden, so in-flight input survives a tab switch
 * and a save in one tab never wipes another. Switching tabs no longer asks for confirmation —
 * edits are saved automatically; only a **failed** save arms the leave guard.
 */
export function ProductTabs({
  tabs,
  statuses,
  onReportStatus,
  initialTab,
  children,
}: {
  tabs: TabDef[];
  statuses: Record<string, SaveStatus>;
  onReportStatus: (tab: string, status: SaveStatus) => void;
  /** 首次渲染时打开的分区（默认第一个）。URL 带 #hash 时以 hash 为准 */
  initialTab?: string;
  children: ReactNode;
}) {
  const firstTab = tabs[0]?.id ?? '';
  const [active, setActive] = useState(
    initialTab && tabs.some((tab) => tab.id === initialTab) ? initialTab : firstTab,
  );

  // 只有「保存失败」才值得在离开时拦一下：那时确实有改动没存下去。
  // 等待保存的 1.5 秒窗口不拦 —— 为了一个还没发生的保存弹框，正是要消灭的噪音。
  const hasFailed = Object.values(statuses).some((status) => status === 'error');

  useEffect(() => {
    if (!hasFailed) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasFailed]);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (tabs.some((tab) => tab.id === hash)) setActive(hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [tabs]);

  const contextValue = useMemo<TabsContextValue>(
    () => ({ active, setActive, statuses, reportStatus: onReportStatus }),
    [active, statuses, onReportStatus],
  );

  const select = (id: string) => {
    if (id === active) return;
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
            const status = statuses[tab.id] ?? 'idle';
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
                {status === 'pending' || status === 'saving' ? (
                  <span aria-hidden className="ml-1 text-navy-400">
                    •
                  </span>
                ) : null}
                {status === 'error' ? (
                  <span aria-hidden className="ml-1 text-copper-600">
                    !
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

/**
 * 各分区的保存状态，供顶部操作栏汇总显示。
 * 操作栏是 ProductTabs 的子节点，所以可以直接读上下文，不必把状态再往上提一层。
 */
export function useSaveStatuses(): Record<string, SaveStatus> {
  const context = useContext(TabsContext);
  return context?.statuses ?? {};
}

/** 供分区在自动保存之外（如媒体结构变化）手动上报状态 */
export function useStatusReporter(): (tab: string, status: SaveStatus) => void {
  const context = useContext(TabsContext);
  const report = context?.reportStatus;
  return useCallback((tab: string, status: SaveStatus) => report?.(tab, status), [report]);
}
