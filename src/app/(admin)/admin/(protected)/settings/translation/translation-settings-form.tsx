'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveTranslationSettingsAction } from '@/lib/admin/actions/translation';
import { initialFormState } from '@/lib/admin/action-state';
import { formatMessage } from '@/lib/admin/i18n';
import { Alert, Field, SubmitButton, TextInput } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

/**
 * 翻译设置表单。
 *
 * Key 输入框**始终为空**、只把脱敏后的当前值显示在下面：
 * 这样即使用户打开开发者工具，也拿不到完整的 Key。
 * 提交时留空 = 不改动，填了 = 换一把新的。
 */
export function TranslationSettingsForm({
  maskedKey,
  hasKey,
  baseUrl,
  model,
  source,
}: {
  maskedKey: string;
  hasKey: boolean;
  baseUrl: string;
  model: string;
  source: 'database' | 'environment' | 'none';
}) {
  const t = useAdminT();
  const router = useRouter();
  const [state, formAction] = useActionState(saveTranslationSettingsAction, initialFormState);

  // 保存成功后重新读取服务端数据：否则「当前密钥：sk-••••」那一行还是旧的，
  // 会让人以为新填的 Key 没生效。
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert kind="success">{state.message}</Alert>
      ) : null}

      {!hasKey ? <Alert kind="info">{t.translation.apiKeyMissing}</Alert> : null}

      <section className="space-y-4 rounded-xl border border-navy-200 bg-white p-5">
        <Field label={t.translation.apiKey} htmlFor="apiKey" hint={t.translation.apiKeyHint}>
          <TextInput
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={t.translation.apiKeyPlaceholder}
          />
        </Field>

        {maskedKey ? (
          <p className="text-xs text-muted">
            {formatMessage(t.translation.apiKeyCurrent, { masked: maskedKey })}
          </p>
        ) : null}
        {source === 'environment' ? (
          <p className="text-xs text-muted">{t.translation.apiKeyFromEnv}</p>
        ) : null}

        <Field label={t.translation.baseUrl} htmlFor="baseUrl" hint={t.translation.baseUrlHint}>
          <TextInput id="baseUrl" name="baseUrl" defaultValue={baseUrl} />
        </Field>

        <Field label={t.translation.model} htmlFor="model" hint={t.translation.modelHint}>
          <TextInput id="model" name="model" defaultValue={model} />
        </Field>

        <div className="flex justify-end">
          <SubmitButton pendingText={t.common.saving}>{t.common.saveChanges}</SubmitButton>
        </div>
      </section>
    </form>
  );
}
