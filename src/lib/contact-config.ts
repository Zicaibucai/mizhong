/**
 * 对外公开的联系方式（公司已确认的真实信息）。
 *
 * 该文件是联系方式的两处唯一来源：
 *   1. 数据库 seed —— 以 `key` 幂等写入，已存在的记录不会被覆盖（保留后台修改）
 *   2. 前台回退 —— 数据库不可用时，前台仍能展示真实联系方式，而不是留空或占位假数据
 *
 * 修改联系方式时同步更新这里，并重新执行 `npm run db:seed`。
 */
export type PublicContactType = 'EMAIL' | 'WHATSAPP' | 'PHONE';

export interface PublicContact {
  /** 稳定标识，仅用于 seed 幂等 */
  key: string;
  type: PublicContactType;
  /** 展示文字 */
  value: string;
  /** 点击链接 */
  href: string;
  sortOrder: number;
  enabled: boolean;
}

export const PUBLIC_CONTACTS: readonly PublicContact[] = [
  {
    key: 'public-whatsapp',
    type: 'WHATSAPP',
    value: '+86 151 0221 5145',
    href: 'https://wa.me/8615102215145',
    sortOrder: 10,
    enabled: true,
  },
  {
    key: 'public-email',
    type: 'EMAIL',
    value: '2936962147@qq.com',
    href: 'mailto:2936962147@qq.com',
    sortOrder: 20,
    enabled: true,
  },
  {
    key: 'public-phone',
    type: 'PHONE',
    value: '+86 151 0221 5145',
    href: 'tel:+8615102215145',
    sortOrder: 30,
    enabled: true,
  },
] as const;
