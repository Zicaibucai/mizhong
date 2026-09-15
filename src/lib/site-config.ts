import type { Locale } from '@/lib/i18n/config';

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
  nameZh: '米众贸易有限公司',
  /** 英文全称（暂定，尚未经公司正式确认——如需修改仅改动此处） */
  nameEn: 'Mizhong Trading Co., Ltd.',
  /** 越南语全称（公司未提供，暂以英文名占位 —— TODO：待公司确认） */
  nameVi: 'Mizhong Trading Co., Ltd.',
} as const;

export const site = {
  name: company.nameEn,
  /** 生产域名 —— TODO：域名提供后替换（优先读环境变量） */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.example.com',
  titleSeparator: '—',
} as const;

/** 公司全称（纯文字身份识别；网站不展示任何图形/字母/临时 Logo） */
export function companyName(locale: Locale): string {
  const map: Record<Locale, string> = { zh: company.nameZh, en: company.nameEn, vi: company.nameVi };
  return map[locale];
}
