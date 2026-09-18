'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createProductVersionAction,
  deleteProductVersionAction,
  restoreProductVersionAction,
} from '@/lib/admin/actions/products';
import { initialFormState } from '@/lib/admin/action-state';
import { formatMessage } from '@/lib/admin/i18n';
import { Alert, SubmitButton } from '@/components/admin/form';
import { useAdminLocale, useAdminT } from '@/components/admin/i18n-provider';
import type { AdminUiLocale } from '@/lib/admin/i18n';
import { cn } from '@/lib/cn';
import { deleteProductAction } from '@/lib/admin/actions/products';
import { DeleteForm } from '@/components/admin/delete-form';
import { DuplicateProductButton } from './duplicate-product-button';
import type { ProductEditorData, ProductVersionData } from './types';

/**
 * 时间戳按后台界面语言格式化（后台只有中/英两种语言）。
 * `createdAt` 是 ISO 字符串，具体时区交给浏览器决定 —— 服务端不猜。
 */
function formatWhen(iso: string, locale: AdminUiLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * 版本历史。
 *
 * 每个商品**最多保留三个版本**（发布时自动留一版，也可以手动存档），超出后最早的被挤掉。
 * 自动保存刻意不产生版本 —— 否则几秒一存，三个名额只会是最近几秒的连续快照，
 * 回滚毫无意义。
 *
 * 「恢复」把内容写回**草稿**而不是直接改线上：恢复之后你在编辑器里就能看到那一版的样子，
 * 确认无误再点「发布」。所以误点恢复也能再退回去，线上内容全程不受影响。
 */
export function VersionsTab({ data }: { data: ProductEditorData }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();

  // 确认语里要出现商品名，让人清楚自己删的是哪一条 —— 回退顺序与编辑器和列表保持一致
  const productName =
    data.translations[locale].name.trim() ||
    data.translations.en.name.trim() ||
    data.translations.zh.name.trim() ||
    data.translations.vi.name.trim();

  const [saveState, saveAction] = useActionState(createProductVersionAction, initialFormState);
  const [restoreState, restoreAction] = useActionState(
    restoreProductVersionAction,
    initialFormState,
  );
  const [deleteState, deleteAction] = useActionState(deleteProductVersionAction, initialFormState);

  const [confirming, setConfirming] = useState<{ id: string; kind: 'restore' | 'delete' } | null>(
    null,
  );

  // 手动存档会新增一行、恢复会改动草稿、删除会少一行 —— 三种都要重新读取服务端数据，
  // 否则列表要等下一次整页刷新才更新（存档完看不到刚存的那一版是最容易让人困惑的）。
  useEffect(() => {
    if (saveState.status === 'success') router.refresh();
  }, [saveState, router]);

  useEffect(() => {
    if (restoreState.status === 'success') router.refresh();
  }, [restoreState, router]);

  useEffect(() => {
    if (deleteState.status === 'success') router.refresh();
  }, [deleteState, router]);

  const notice =
    restoreState.status === 'success' && restoreState.message
      ? { kind: 'success' as const, text: restoreState.message }
      : saveState.status === 'success' && saveState.message
        ? { kind: 'success' as const, text: saveState.message }
        : deleteState.status === 'success' && deleteState.message
          ? { kind: 'success' as const, text: deleteState.message }
          : null;

  const error =
    restoreState.status === 'error' && restoreState.message
      ? restoreState.message
      : saveState.status === 'error' && saveState.message
        ? saveState.message
        : deleteState.status === 'error' && deleteState.message
          ? deleteState.message
          : null;

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.versionSection}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t.products.versionHint}</p>
        </div>

        {error ? <Alert kind="error">{error}</Alert> : null}
        {notice ? <Alert kind="success">{notice.text}</Alert> : null}

        <form action={saveAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={data.product.id} />
          <label className="min-w-[16rem] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-navy-700">
              {t.products.versionNote}
            </span>
            <input
              type="text"
              name="note"
              maxLength={200}
              placeholder={t.products.versionNotePlaceholder}
              className="h-10 w-full rounded-lg border border-navy-200 px-3 text-sm text-navy-900 focus:border-copper-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
            />
          </label>
          <SubmitButton pendingText={t.common.saving}>{t.products.versionSaveNow}</SubmitButton>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        {data.versions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-200 px-5 py-6 text-sm text-muted">
            {t.products.versionEmpty}
          </p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {data.versions.map((version) => (
              <VersionRow
                key={version.id}
                version={version}
                locale={locale}
                confirming={confirming}
                setConfirming={setConfirming}
                restoreAction={restoreAction}
                deleteAction={deleteAction}
                productId={data.product.id}
              />
            ))}
          </ul>
        )}

        <p className="text-xs text-muted">{t.products.versionMax}</p>
      </section>

      {/*
        商品管理区：复制与删除。
        这两个入口原本都在「基本信息」分区里，编辑器改版后那个分区不再渲染，
        于是后台既不能删也不能复制商品 —— 这里把它们放回来。
      */}
      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">{t.products.duplicate}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t.products.duplicateHint}</p>
        </div>
        <DuplicateProductButton
          productId={data.product.id}
          productName={productName || t.products.unnamedProduct}
        />
      </section>

      {/*
        商品删除入口。

        放在「版本」分区而不是编辑区里，是刻意的：删除是不可撤销的破坏性操作，
        离日常编辑的输入框越远越好，免得误点。位置虽然换了，用的还是同一个
        DeleteForm（两步确认、无浏览器弹窗）与同一个 deleteProductAction
        （服务端校验管理员会话、级联删除、写审计、删完重定向并清缓存）。
      */}
      <section className="space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-5">
        <div>
          <h2 className="text-sm font-semibold text-red-800">{t.products.delete}</h2>
          <p className="mt-1 text-xs leading-relaxed text-red-700">{t.common.deleteWarning}</p>
        </div>
        <DeleteForm
          action={deleteProductAction}
          id={data.product.id}
          label={t.products.delete}
          confirmText={formatMessage(t.products.deleteConfirmNamed, {
            name: productName || t.products.unnamedProduct,
          })}
        />
      </section>
    </div>
  );
}

function VersionRow({
  version,
  locale,
  confirming,
  setConfirming,
  restoreAction,
  deleteAction,
  productId,
}: {
  version: ProductVersionData;
  locale: AdminUiLocale;
  confirming: { id: string; kind: 'restore' | 'delete' } | null;
  setConfirming: (value: { id: string; kind: 'restore' | 'delete' } | null) => void;
  restoreAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  productId: string;
}) {
  const t = useAdminT();
  const isConfirmingRestore = confirming?.id === version.id && confirming.kind === 'restore';
  const isConfirmingDelete = confirming?.id === version.id && confirming.kind === 'delete';

  const kindLabel =
    version.kind === 'PUBLISHED'
      ? t.products.versionKindPublished
      : t.products.versionKindManual;

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs',
              version.kind === 'PUBLISHED'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-navy-100 text-navy-700',
            )}
          >
            {kindLabel}
          </span>
          <span className="text-sm text-navy-800">{formatWhen(version.createdAt, locale)}</span>
          {version.createdBy ? (
            <span className="text-xs text-muted">
              {formatMessage(t.products.versionCreatedBy, { name: version.createdBy })}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm text-navy-900">
          {version.snapshotName || t.products.unnamedProduct}
          {version.snapshotPrice ? (
            <span className="ml-2 text-muted">{version.snapshotPrice}</span>
          ) : null}
        </p>
        {version.note ? <p className="mt-1 text-xs text-muted">{version.note}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isConfirmingRestore ? (
          <>
            <span className="text-xs text-navy-700">{t.products.versionRestoreConfirm}</span>
            <form action={restoreAction}>
              <input type="hidden" name="id" value={productId} />
              <input type="hidden" name="versionId" value={version.id} />
              <SubmitButton pendingText={t.common.processing}>
                {t.products.versionRestore}
              </SubmitButton>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="text-xs text-navy-600 hover:underline"
            >
              {t.common.cancel}
            </button>
          </>
        ) : isConfirmingDelete ? (
          <>
            <span className="text-xs text-navy-700">{t.products.versionDeleteConfirm}</span>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={productId} />
              <input type="hidden" name="versionId" value={version.id} />
              <SubmitButton pendingText={t.common.processing}>
                {t.products.versionDelete}
              </SubmitButton>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="text-xs text-navy-600 hover:underline"
            >
              {t.common.cancel}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirming({ id: version.id, kind: 'restore' })}
              className="inline-flex h-9 items-center rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
            >
              {t.products.versionRestore}
            </button>
            <button
              type="button"
              onClick={() => setConfirming({ id: version.id, kind: 'delete' })}
              className="inline-flex h-9 items-center rounded-full px-3 text-sm text-navy-600 transition-colors hover:bg-navy-100"
            >
              {t.products.versionDelete}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
