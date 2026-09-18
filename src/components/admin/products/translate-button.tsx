'use client';

import { useCallback, useState, useTransition } from 'react';
import { translateProductContentAction } from '@/lib/admin/actions/translation';
import { formatMessage } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';
import { getContentLocaleLabel } from '@/lib/admin/labels';
import { ADMIN_LOCALES, type AdminLocale } from '@/lib/admin/validation';
import { cn } from '@/lib/cn';
import {
  SOURCE_LOCALE,
  TRANSLATABLE_FIELDS,
  type TranslatableField,
} from '@/lib/translation/fields';
import type { Locale } from '@/lib/i18n/config';

/**
 * 「一键翻译」按钮。
 *
 * 工作方式：
 *   1. **先读表单，再发请求** —— 直接把 DOM 里**当前**的值收集起来交给服务端，
 *      而不是让服务端去数据库取旧值。需求明确要求「翻译前先读取前端表单中的最新内容」，
 *      用户刚改过还没保存的中文同样要能翻。
 *   2. 服务端调用 DeepSeek，把「字段 × 语言」一次翻完（见 translation.ts）。
 *   3. 译文按 `语言_字段` 的输入框名字**逐个回填**，不存在错位的可能。
 *
 * 与自动保存的关系：回填后会派发一次 `input` 事件，于是这些字段和用户手打的字一样
 * 走既有的自动保存。本项目的「保存」只写进**草稿**，客人看到的仍是上一版；
 * 真正对外生效仍然要点「发布」—— 所以「先翻译、再检查、最后自己决定何时发布」这条
 * 流程是成立的。翻译动作本身**不会**提交或保存整个表单。
 */
export function TranslateButton({
  formIds,
  targets,
}: {
  /** 需要扫描的表单 id（可视化编辑器有多个表单） */
  formIds: string[];
  /** 将要翻译成的目标语言 */
  targets: Locale[];
}) {
  const t = useAdminT();
  const [pending, startTransition] = useTransition();
  const [overwrite, setOverwrite] = useState(false);
  const [notice, setNotice] = useState<
    { kind: 'success' | 'error' | 'info'; text: string } | null
  >(null);
  const [highlighted, setHighlighted] = useState(false);

  /** 找到某个「语言 + 字段」的输入框。同名输入可能有多个（可视化页与分区页各一份），
   *  这里以**第一个可见的**为准，避免写到隐藏的那一份上。 */
  const findInputs = useCallback(
    (locale: string, field: TranslatableField): (HTMLInputElement | HTMLTextAreaElement)[] => {
      const found: (HTMLInputElement | HTMLTextAreaElement)[] = [];
      for (const formId of formIds) {
        const form = document.getElementById(formId);
        if (!form) continue;
        found.push(
          ...Array.from(
            form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
              `[name="${locale}_${field}"]`,
            ),
          ),
        );
      }
      return found;
    },
    [formIds],
  );

  const readForm = useCallback(() => {
    const source: Record<string, string> = {};
    const existing: Record<string, Record<string, string>> = {};

    for (const field of TRANSLATABLE_FIELDS) {
      const zhInput = findInputs(SOURCE_LOCALE, field)[0];
      source[field] = zhInput?.value ?? '';

      for (const locale of ADMIN_LOCALES) {
        if (locale === SOURCE_LOCALE) continue;
        const input = findInputs(locale, field)[0];
        if (!input) continue;
        existing[locale] = { ...(existing[locale] ?? {}), [field]: input.value };
      }
    }

    return { source, existing };
  }, [findInputs]);

  const run = () => {
    setNotice(null);

    const { source, existing } = readForm();
    const hasAnySource = Object.values(source).some((value) => value.trim().length > 0);
    if (!hasAnySource) {
      setNotice({ kind: 'error', text: t.translation.emptySource });
      return;
    }

    startTransition(async () => {
      const result = await translateProductContentAction({
        source,
        targets,
        existing,
        overwrite,
      });

      if (result.status === 'error') {
        // 失败时**什么都不改** —— 表单保持原样，用户可以继续手工编辑
        setNotice({ kind: 'error', text: result.message });
        return;
      }

      // 回填。译文是按「语言_字段」名字定位的，不存在填错位置的可能。
      let written = 0;
      for (const [locale, fields] of Object.entries(result.applied)) {
        for (const [field, value] of Object.entries(fields) as [TranslatableField, string][]) {
          const inputs = findInputs(locale, field);
          const target = inputs.find((input) => input.offsetParent !== null) ?? inputs[0];
          if (!target) continue;
          target.value = value;
          // 与用户手打一样触发自动保存（写进草稿，不是线上）
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.classList.add('ring-2', 'ring-copper-400', 'bg-copper-50/40');
          target.addEventListener(
            'input',
            () => target.classList.remove('ring-2', 'ring-copper-400', 'bg-copper-50/40'),
            { once: true },
          );
          written += 1;
        }
      }

      setHighlighted(written > 0);

      if (written === 0) {
        setNotice({ kind: 'info', text: t.translation.nothingApplied });
        return;
      }

      const localeCount = Object.keys(result.applied).length;
      const lines = [
        formatMessage(t.translation.success, {
          fields: result.fieldCount,
          languages: localeCount,
        }),
      ];
      if (result.skipped.length > 0) {
        lines.push(formatMessage(t.translation.skipped, { count: result.skipped.length }));
      }
      if (result.failures.length > 0) {
        lines.push(
          formatMessage(t.translation.partial, {
            locales: result.failures
              .map((failure) => getContentLocaleLabel(t, failure.locale as AdminLocale))
              .join('、'),
          }),
        );
      }
      setNotice({ kind: result.failures.length > 0 ? 'info' : 'success', text: lines.join(' ') });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-copper-700 px-5 text-sm font-medium text-ivory-50 transition-colors hover:bg-copper-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t.translation.translating : t.translation.button}
        </button>
        <label
          htmlFor="translate-overwrite"
          className="inline-flex items-center gap-2 text-sm text-navy-800"
        >
          <input
            id="translate-overwrite"
            name="translate-overwrite"
            type="checkbox"
            checked={overwrite}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setOverwrite(event.target.checked)
            }
            className="h-4 w-4 rounded border-navy-300 text-copper-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
          />
          {t.translation.overwrite}
        </label>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        {formatMessage(t.translation.buttonHint, {
          count: targets.length,
          languages: targets.map((locale) => getContentLocaleLabel(t, locale as AdminLocale)).join('、'),
        })}
        {' · '}
        {t.translation.overwriteHint}
      </p>

      {highlighted ? (
        <p className="text-xs text-copper-700">{t.translation.highlightHint}</p>
      ) : null}

      {notice ? (
        <div className={cn(pending ? 'opacity-60' : null)}>
          <Alert kind={notice.kind}>{notice.text}</Alert>
        </div>
      ) : null}
    </div>
  );
}
