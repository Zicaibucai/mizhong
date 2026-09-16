import type { Locale } from '@/lib/i18n/config';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import {
  currencySymbol,
  decimalToString,
  formatAmount,
  normalizeCurrency,
  unitLabel,
} from '@/lib/pricing';

/**
 * 商品价格 / 数量的**展示层**格式化。
 *
 * 输入是已经跨过服务端边界的字符串（Decimal 已转字符串），因此这里只做展示，
 * 不做任何浮点运算 —— 数值比较与校验发生在服务端 Zod 校验里。
 */

export interface PriceInput {
  priceMode: string;
  currency: string;
  priceMin: string | null;
  priceMax: string | null;
  priceUnit: string | null;
}

/** 带货币符号的金额，例如 `$1,234.00` / `¥1,234.00` */
function withSymbol(amount: string, currency: string, locale: Locale): string {
  return `${currencySymbol(currency)}${formatAmount(amount, locale)}`;
}

/**
 * 价格的完整展示文案。
 *
 * - NEGOTIABLE 或缺少价格数字 → 面议（绝不用 0 或占位符冒充价格）
 * - FIXED → `$1.20 / meter`
 * - RANGE → `$1.20 – $2.50 / meter`（上限缺失时退回 FIXED 的写法）
 */
export function formatPrice(input: PriceInput, locale: Locale): string {
  const dict = getCatalogDict(locale);
  const currency = normalizeCurrency(input.currency);
  const min = decimalToString(input.priceMin);
  const max = decimalToString(input.priceMax);
  const unit = unitLabel(input.priceUnit, dict.units);

  if (input.priceMode === 'NEGOTIABLE' || !min) return dict.price.onRequest;

  if (input.priceMode === 'RANGE' && max) {
    return format(unit ? dict.price.range : dict.price.rangeNoUnit, {
      min: withSymbol(min, currency, locale),
      max: withSymbol(max, currency, locale),
      unit,
    });
  }

  return format(unit ? dict.price.fixed : dict.price.fixedNoUnit, {
    amount: withSymbol(min, currency, locale),
    unit,
  });
}

/** 是否应当输出结构化价格数据（面议商品绝不伪造 Offer 价格） */
export function hasNumericPrice(input: PriceInput): boolean {
  if (input.priceMode === 'NEGOTIABLE') return false;
  return decimalToString(input.priceMin) !== null;
}

/**
 * 用于 JSON-LD 的 `price`：纯十进制字符串，固定两位小数、不含货币符号与千分位。
 *
 * 用 `Prisma.Decimal` 自己的 `toFixed`（十进制运算），不经过 `Number` ——
 * 金额在任何一步转成浮点都可能引入误差。`1.2` → `1.20`，
 * 与页面上展示的金额写法一致，搜索引擎解析也更明确。
 */
export function rawPrice(input: PriceInput): string | null {
  if (!hasNumericPrice(input)) return null;
  return toDecimalString(decimalToString(input.priceMin));
}

/** 用于 JSON-LD 的高价；FIXED 时与低价相同 */
export function rawHighPrice(input: PriceInput): string | null {
  if (!hasNumericPrice(input)) return null;
  return toDecimalString(decimalToString(input.priceMax) ?? decimalToString(input.priceMin));
}

/** 把 `1.2` 这样的十进制字面量补成两位小数；非法输入原样返回 */
function toDecimalString(value: string | null): string | null {
  if (!value) return value;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign, whole, fraction = ''] = match;
  const cents = `${fraction}00`.slice(0, 2);
  return `${sign}${whole}.${cents}`;
}

/** 计价单位的可读写法（详情页 / 卡片共用） */
export function productUnitLabel(unit: string | null, locale: Locale): string {
  return unitLabel(unit, getCatalogDict(locale).units);
}

/** 起订量文案，例如「1,000 米」；缺少数量时返回 null，由调用方隐藏该行 */
export function formatMoq(
  moq: number | null,
  moqUnit: string | null,
  locale: Locale,
): string | null {
  if (moq === null || moq === undefined) return null;
  const dict = getCatalogDict(locale);
  const unit = unitLabel(moqUnit, dict.units);
  return format(unit ? dict.detail.moqValue : '{quantity}', {
    quantity: new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'vi' ? 'vi-VN' : 'en-US').format(
      moq,
    ),
    unit,
  }).trim();
}
