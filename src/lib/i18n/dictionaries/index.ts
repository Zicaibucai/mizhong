import { en } from './en';
import { zh } from './zh';
import { vi } from './vi';
import { es } from './es';
import { ja } from './ja';
import { ru } from './ru';
import { ar } from './ar';
import { fr } from './fr';
import { ko } from './ko';
import { pt } from './pt';
import { hi } from './hi';
import type { Locale } from '../config';
import type { Dict } from './en';

/**
 * 语言 → 字典。
 *
 * `Record<Locale, Dict>` 是刻意的：往 `locales` 里加一种语言而忘了写字典，
 * 这里会直接编译不过，而不是等到线上某个页面渲染出 undefined。
 * zh / vi / es … 全部与 en 共享 `Dict` 类型，缺键、多键同样是编译期错误。
 */
const dictionaries: Record<Locale, Dict> = { zh, en, vi, es, ja, ru, ar, fr, ko, pt, hi };

/**
 * 按语言取字典。所有文案集中管理于此，禁止在组件中硬编码。
 */
export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}

export type { Dict } from './en';
