import type { AdminLocale } from './validation';

export const LOCALE_LABELS: Record<AdminLocale, string> = {
  zh: '中文',
  en: 'English',
  vi: 'Tiếng Việt',
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  EMAIL: '邮箱 Email',
  WHATSAPP: 'WhatsApp',
  PHONE: '电话 Phone',
  WECHAT: '微信 WeChat',
  ADDRESS: '地址 Address',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: '登录',
  LOGIN_FAILED: '登录失败',
  LOGOUT: '退出登录',
  CREATE: '创建',
  UPDATE: '修改',
  DELETE: '删除',
  PUBLISH: '发布',
  UNPUBLISH: '取消发布',
};

export const PAGE_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
};

export const BLOCK_LABELS: Record<string, string> = {
  hero: '首屏 Hero',
  capabilities: '企业能力',
  products: '产品',
  supply: '供应链',
  quality: '质量与信任',
  inquiry: '询盘 CTA',
};

export function blockLabel(key: string): string {
  return BLOCK_LABELS[key] ?? key;
}
