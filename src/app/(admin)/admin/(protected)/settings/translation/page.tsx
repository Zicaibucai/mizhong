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
    : { apiKey: '', baseUrl: DEFAULT_DEEPSEEK_BASE_URL, model: DEFAULT_DEEPSEEK_MODEL, source: 'none' as const, keyStorage: null };

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

      {/*
        配置错误要**显式说出来**。
        「库里存了密钥但服务器解不开」（环境变量缺失或被换掉）与「压根没配过」是两回事：
        前者如果只显示「还没配置」，管理员会以为要重新申请一把 Key，而真正要做的是恢复那个变量。
        这种情况下翻译会直接返回未配置，不会反复发起注定失败的 DeepSeek 调用。
      */}
      {settings.keyStorage === 'unreadable' ? (
        <Alert kind="error">{t.translation.keyUnreadable}</Alert>
      ) : null}

      <TranslationSettingsForm
        maskedKey={maskApiKey(settings.apiKey)}
        hasKey={Boolean(settings.apiKey)}
        baseUrl={settings.baseUrl}
        model={settings.model}
        source={settings.source}
        keyStorage={settings.keyStorage}
      />
    </div>
  );
}
