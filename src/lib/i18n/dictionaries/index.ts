import { en } from './en';
import { zh } from './zh';
import { vi } from './vi';
import type { Locale } from '../config';
import type { Dict } from './en';

const dictionaries: Record<Locale, Dict> = { zh, en, vi };

/**
 * 按语言取字典。所有文案集中管理于此，禁止在组件中硬编码。
 * zh / vi 与 en 共享 Dict 类型，缺失或多余的键会在编译期报错。
 */
export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}

export type { Dict } from './en';
