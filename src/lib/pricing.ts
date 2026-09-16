import type { Locale } from '@/lib/i18n/config';

/**
 * 价格与贸易信息的**唯一事实来源**：币种、计价单位、价格模式的取值与格式化。
 *
 * 金额在数据库中是 Prisma `Decimal`，跨越服务端/客户端边界时一律以**字符串**传递
 * （Decimal → number 会丢精度，也不可能作为 Server Action 的参数序列化）。
 */

export const PRICE_MODES = ['NEGOTIABLE', 'FIXED', 'RANGE'] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const CURRENCY_CODES = ['USD', 'CNY', 'VND', 'EUR'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/**
 * 计价单位 / 起订单位的候选值。
 * 后台是「可选可填」的下拉框（datalist），既不限制管理员输入，也保证常用单位拼写一致。
 */
export const TRADE_UNITS = [
  'piece',
  'set',
  'pair',
  'meter',
  'yard',
  'roll',
  'kilogram',
  'ton',
  'box',
  'carton',
] as const;

/** 货币符号（用于紧凑展示；未知币种回退为代码本身） */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  VND: '₫',
  EUR: '€',
};

/** `Intl` 使用的地区代码，决定千分位与小数点符号 */
const NUMBER_LOCALES: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  vi: 'vi-VN',
};

export function isPriceMode(value: unknown): value is PriceMode {
  return typeof value === 'string' && (PRICE_MODES as readonly string[]).includes(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCY_CODES as readonly string[]).includes(value);
}

/** 归一化币种：非法/缺失一律回退 USD，保证前台不会显示空币种 */
export function normalizeCurrency(value: string | null | undefined): CurrencyCode {
  const upper = (value ?? '').trim().toUpperCase();
  return isCurrencyCode(upper) ? upper : DEFAULT_CURRENCY;
}

/**
 * Prisma Decimal → 字符串。
 *
 * Decimal 与 number 相加会隐式转成 float，而 `toFixed()` 又会引入新的舍入，
 * 因此这里只调用 Decimal 自己的 `toString()`。空值与非法值返回 null。
 */
export function decimalToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const text = (value as { toString: () => string }).toString();
    // Prisma.Decimal 的 toString() 永远是十进制字面量；NaN/Infinity 说明数据异常，丢弃
    return /^-?\d+(\.\d+)?$/.test(text) ? text : null;
  }
  return null;
}

/** 金额：固定 2 位小数 + 千分位，使用当前语言的习惯写法 */
export function formatAmount(value: string, locale: Locale): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.NumberFormat(NUMBER_LOCALES[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

/** 起订量等整数：加千分位；非整数输入原样返回 */
export function formatQuantity(value: number, locale: Locale): string {
  return new Intl.NumberFormat(NUMBER_LOCALES[locale]).format(value);
}

/** 计算单位（如 kilogram）在当前语言下的可读写法；字典缺失时回退原文 */
export function unitLabel(unit: string | null | undefined, unitNames: Record<string, string>): string {
  const key = (unit ?? '').trim();
  if (!key) return '';
  return unitNames[key] ?? key;
}
