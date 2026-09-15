export const locales = ['zh', 'en', 'vi'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh';

/** 语言在切换器中的显示名（始终用该语言自身命名） */
export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  vi: 'Tiếng Việt',
};

/** 各语言对应的 BCP-47 语言代码，用于 <html lang> 与 hreflang */
export const localeCodes: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en',
  vi: 'vi',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
