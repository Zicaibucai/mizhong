import { z } from 'zod';
import { localeEnglishNames, locales, type Locale } from '@/lib/i18n/config';
import { MAX_TOTAL_SOURCE_LENGTH, type TranslationUnit, type UnitFormat } from './document';

/**
 * 通用翻译批次。
 *
 * 与 `fields.ts` 里那套「商品字段白名单」的关系：白名单那套是**用户直接点按钮**时的
 * 信任边界（浏览器传什么、接受什么，必须严格收敛）；这一层是**服务端自己**构造的批次，
 * 键名来自适配器生成的稳定路径，不经过浏览器。
 *
 * 两者共用同一个系统提示词与同一份返回校验逻辑，只是键名从「八个固定的商品字段」
 * 放开成任意路径。放开的安全性由**构造方**保证：只有适配器能生成键名，
 * 而适配器只输出白名单里的字段（见 adapters.ts），结构字段（slug、链接、价格）
 * 根本不进去。
 */

/**
 * 批次里的一个字段。
 *
 * 就是 `TranslationUnit` 本身 —— 刻意不给批次另造一个形状：多一层转换就意味着
 * 多一处可能漏字段的地方，而这里要的字段（路径、说明、原文、形态）完全一致。
 */
export type BatchUnit = TranslationUnit;

/** 系统提示词里针对内容形态追加的一句。三种形态都要求「不要动结构」。 */
const FORMAT_RULES: Record<UnitFormat, string> = {
  text: '',
  html: '  这段是 HTML 片段：标签、属性、链接地址必须原样保留，只翻译标签之间的可见文字。',
  markdown: '  这段是 Markdown：标记符号（#、*、-、[]() 等）必须原样保留，只翻译标记之间的文字。',
};

/**
 * 构造用户消息。
 *
 * 键名**原样**留在 JSON 里：模型只要照着键回填，就不存在「把名称填进描述里」这类错位。
 * 需求里「不能把内容填错位置」是靠结构保证的，不是靠模型自觉。
 */
export function buildUnitPrompt(units: readonly BatchUnit[], targets: readonly Locale[]): string {
  const languageList = targets.map((locale) => `- ${locale}: ${localeEnglishNames[locale]}`).join('\n');
  const fieldList = units.map((unit) => `- ${unit.path}: ${unit.label}`).join('\n');

  const formatNotes = [
    ...new Set(units.filter((unit) => unit.format !== 'text').map((unit) => unit.format)),
  ].map((format) => FORMAT_RULES[format]);

  const shape = targets
    .map((locale) => `    "${locale}": { ${units.map((unit) => `"${unit.path}": "译文"`).join(', ')} }`)
    .join(',\n');

  const source: Record<string, string> = {};
  for (const unit of units) source[unit.path] = unit.text;

  return [
    '请把下面 JSON 中 source 里的每个中文字段，翻译成这些语言：',
    languageList,
    '',
    '需要翻译的字段：',
    fieldList,
    '',
    '严格按这个结构返回（键名原样保留，不要增删）：',
    '{',
    '  "translations": {',
    shape,
    '  }',
    '}',
    '',
    '要求：',
    '1. 每个字段的译文必须放回**同名字段**，不要错位。键名一个字都不要改。',
    '2. 某条原文为空时不要凭空补内容。',
    '3. 数字、单位、型号、品牌名保持原样（例如 "25 mm"、"A-2026"、"3M" 不要翻译）。',
    '4. 原文里的 HTML 标签、Markdown 标记、{占位符} 原样保留。',
    '5. 只输出 JSON，不要输出任何解释或 Markdown 代码块。',
    ...formatNotes,
    '',
    '原文：',
    JSON.stringify({ source }, null, 2),
  ].join('\n');
}

/**
 * 校验模型的返回。
 *
 * 只接受「目标语言都在、键名都在」的结果；多出来的键直接忽略，
 * 缺的键按「该字段翻译失败」处理，**绝不编造内容**。
 */
export function parseUnitResponse(
  raw: unknown,
  keys: readonly string[],
  targets: readonly Locale[],
): Record<string, Record<string, string>> | null {
  if (!raw || typeof raw !== 'object') return null;
  const container = (raw as Record<string, unknown>).translations;
  if (!container || typeof container !== 'object') return null;

  const values: Record<string, Record<string, string>> = {};

  for (const locale of targets) {
    const entry = (container as Record<string, unknown>)[locale];
    if (!entry || typeof entry !== 'object') continue;

    const filled: Record<string, string> = {};
    for (const key of keys) {
      const value = (entry as Record<string, unknown>)[key];
      if (typeof value !== 'string') continue;
      const text = value.trim();
      // 模型返回空串＝这条没翻出来，宁可留空让用户自己填，也不填个占位符进去
      if (text) filled[key] = text;
    }
    if (Object.keys(filled).length > 0) values[locale] = filled;
  }

  return Object.keys(values).length > 0 ? values : null;
}

/** 批次体积上限：与用户触发的翻译共用同一档，避免出现「服务端自己放宽限制」的漏洞 */
export function isBatchTooLarge(units: readonly BatchUnit[]): boolean {
  return units.reduce((sum, unit) => sum + unit.text.length, 0) > MAX_TOTAL_SOURCE_LENGTH;
}

export const batchTargetSchema = z.array(z.enum(locales)).min(1);
