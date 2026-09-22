import type { Locale } from '@/lib/i18n/config';
import { PRODUCTION_ORIGIN, resolveSiteOrigin } from '@/lib/site-origin';

/**
 * 公司信息统一配置（前台回退值）。
 * 运行时优先读取数据库中的公司资料（见 src/lib/content.ts）；
 * 数据库不可用时回退到此处，保证前台不崩溃。
 *
 * 注意：这里只保留「已知且真实」的信息——公司名称。
 * 地址、电话、邮箱、WhatsApp 等尚未提供，一律不在此处填写占位值，
 * 由后台「联系方式」配置，未配置时前台不展示。
 */
export const company = {
  /** 中文全称（已确认） */
  nameZh: '米众新材料有限公司',
  /** 海外页面统一使用英文品牌名。 */
  nameEn: 'Mizhong New Materials Co., Ltd.',
  nameVi: 'Mizhong New Materials Co., Ltd.',
} as const;

export const site = {
  name: company.nameEn,
  /**
   * 已启用 HTTPS；顺带纠正服务器遗留的 HTTP/IP 配置。
   * 与 middleware 的跳转共用同一套解析规则（见 `@/lib/site-origin`），
   * 否则会出现「canonical 写 A、跳转去 B」这种自相矛盾的输出。
   */
  url: resolveSiteOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    fallback: PRODUCTION_ORIGIN,
  }),
  titleSeparator: '—',
} as const;

/** 公司全称（纯文字身份识别；网站不展示任何图形/字母/临时 Logo） */
export function companyName(locale: Locale): string {
  // 目前只有中文全称与英文全称两种写法，其余语言一律沿用英文全称。
  // 需要为某个语言单独起名时，在 site-config 里加字段再在这里分支即可。
  return locale === 'zh' ? company.nameZh : company.nameEn;
}

/**
 * 页头在窄屏使用的品牌短名。
 *
 * 手机端页头放不下公司全称 —— 英文与阿语会被截成省略号（2026-09-22 报），
 * 而「米众新材料有限公司…」这种被截断的身份标识比短名更难认。短名取公司名里
 * 真正是品牌的那一段：拉丁文取第一个词（Mizhong），中文取前两个字（米众）。
 * 从 `companyName` 派生，将来改品牌名不会漏掉这里。
 */
export function companyShortName(locale: Locale): string {
  const full = companyName(locale).trim();
  const firstWord = full.split(/\s+/)[0] ?? full;
  if (/^[㐀-鿿]/.test(firstWord)) return firstWord.slice(0, 2);
  return firstWord.replace(/[.,;:]+$/, '') || full;
}
