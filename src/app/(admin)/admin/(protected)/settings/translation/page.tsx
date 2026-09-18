import { requireAdminPage } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { Alert } from '@/components/admin/form';
import {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  loadTranslationSettings,
  maskApiKey,
} from '@/lib/translation/settings';
import { TranslationSettingsForm } from './translation-settings-form';

export const dynamic = 'force-dynamic';

/**
 * DeepSeek 翻译设置。
 *
 * 页面本身是服务端组件，读取配置后**只把脱敏后的 Key** 交给客户端表单 ——
 * 完整 Key 从不进入浏览器。留空提交表示「不修改」。
 */
export default async function TranslationSettingsPage() {
  await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  const db = getPrisma();
  const settings = db
    ? await loadTranslationSettings(db)
    : { apiKey: '', baseUrl: DEFAULT_DEEPSEEK_BASE_URL, model: DEFAULT_DEEPSEEK_MODEL, source: 'none' as const };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">
          {t.translation.settingsTitle}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          {t.translation.settingsSubtitle}
        </p>
      </header>

      {!db ? <Alert kind="error">{t.products.dbUnavailable}</Alert> : null}

      <TranslationSettingsForm
        maskedKey={maskApiKey(settings.apiKey)}
        hasKey={Boolean(settings.apiKey)}
        baseUrl={settings.baseUrl}
        model={settings.model}
        source={settings.source}
      />
    </div>
  );
}
