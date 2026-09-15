import type { Locale } from '@/lib/i18n/config';

/**
 * 公司信息统一配置。
 * 所有需要后续修改的商务信息集中于此，禁止散落硬编码到组件中。
 */
export const company = {
  /** 中文全称（已确认） */
  nameZh: '米众贸易有限公司',
  /** 英文全称（暂定，尚未经公司正式确认——如需修改仅改动此处） */
  nameEn: 'Mizhong Trading Co., Ltd.',
  /** 越南语全称（公司未提供，暂以英文名占位 —— TODO：待公司确认） */
  nameVi: 'Mizhong Trading Co., Ltd.',

  /** 联系方式占位 —— TODO：待公司提供真实信息后统一替换 */
  contact: {
    email: 'sales@mizhong-trade.example',
    phone: '+86 000 0000 0000',
    address: {
      zh: '中国 · 详细地址待补充',
      en: 'China · Address to be confirmed',
      vi: 'Trung Quốc · Địa chỉ chờ xác nhận',
    },
  },

  /** ICP 备案号占位 —— TODO：部署前补充 */
  icp: {
    zh: 'ICP 备案号待补充',
    en: 'ICP filing pending',
    vi: 'Số đăng ký ICP đang chờ',
  },
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

export function contactAddress(locale: Locale): string {
  return company.contact.address[locale];
}

export function icpText(locale: Locale): string {
  return company.icp[locale];
}
