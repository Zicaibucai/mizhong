/**
 * 站点的语言清单 —— **唯一的定义处**。
 *
 * 任何地方需要「系统支持哪些语言」，都从这里取，不要在别处再抄一份：
 * 数据库枚举、后台可编辑语言、路由、hreflang、站点地图、货币/数字格式
 * 全部由这个数组派生。
 *
 * 新增一种语言的顺序：
 *   1. 在这个数组里加上它；
 *   2. prisma/schema.prisma 的 `enum Locale` 加上同名成员并生成迁移；
 *   3. 补上 dictionaries/ 与 catalog.ts 里对应的那一份文案。
 * 类型系统会把所有遗漏的地方标出来。
 */
export const locales = [
  'zh',
  'en',
  'vi',
  'es',
  'ja',
  'ru',
  'ar',
  'fr',
  'ko',
  'pt',
  'hi',
] as const;

export type Locale = (typeof locales)[number];

/** 默认语言：站点根路径会重定向到它 */
export const defaultLocale: Locale = 'zh';

/** 语言在切换器中的显示名（始终用该语言自身命名） */
export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  vi: 'Tiếng Việt',
  es: 'Español',
  ja: '日本語',
  ru: 'Русский',
  ar: 'العربية',
  fr: 'Français',
  ko: '한국어',
  pt: 'Português',
  hi: 'हिन्दी',
};

/** 各语言对应的 BCP-47 语言代码，用于 <html lang> 与 hreflang */
export const localeCodes: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en',
  vi: 'vi',
  es: 'es',
  ja: 'ja',
  ru: 'ru',
  ar: 'ar',
  fr: 'fr',
  ko: 'ko',
  pt: 'pt',
  hi: 'hi',
};

/**
 * 文字方向。
 *
 * 阿拉伯语需要 `dir="rtl"`。注意：站点现有样式是 LTR 的物理方向写法，
 * 这里先把文档方向标对（浏览器会把标点、表单控件、滚动条放到正确的一侧），
 * 完整的 RTL 镜像布局属于后续工作。
 */
export const localeDirs: Record<Locale, 'ltr' | 'rtl'> = {
  zh: 'ltr',
  en: 'ltr',
  vi: 'ltr',
  es: 'ltr',
  ja: 'ltr',
  ru: 'ltr',
  ar: 'rtl',
  fr: 'ltr',
  ko: 'ltr',
  pt: 'ltr',
  hi: 'ltr',
};

/**
 * 语言的英文名。给**翻译提示词**用：模型对语言名的理解比语言代码可靠，
 * 提示词里写 "Japanese" 比写 "ja" 稳定得多。
 */
export const localeEnglishNames: Record<Locale, string> = {
  zh: 'Simplified Chinese',
  en: 'English',
  vi: 'Vietnamese',
  es: 'Spanish',
  ja: 'Japanese',
  ru: 'Russian',
  ar: 'Arabic',
  fr: 'French',
  ko: 'Korean',
  pt: 'Portuguese',
  hi: 'Hindi',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
