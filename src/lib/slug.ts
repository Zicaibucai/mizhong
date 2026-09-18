/**
 * 网址后缀（slug）的生成与校验。
 *
 * 规则（由需求指定）：
 *   - 只用小写英文字母、数字和下划线；
 *   - 单词之间用下划线连接；
 *   - 去掉标点与特殊字符，去掉首尾下划线；
 *   - 连续的空格或分隔符合并成一个下划线。
 *
 * 「Industrial Water Pump 2026」→ `industrial_water_pump_2026`
 *
 * 关于分隔符的一点说明：项目**历史数据**里的 slug 用的是连字符（`a-b`），
 * 而需求要求新生成的用下划线。两者都保留在 `SLUG_PATTERN` 里，这样老商品
 * 不会因为改了生成规则就发布不出去；新生成的则一律是下划线。
 */

/** 合法的 slug：小写字母/数字，用连字符或下划线分隔 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

/** slug 的最大长度，与 Zod 校验保持一致 */
export const SLUG_MAX_LENGTH = 120;

/**
 * 把任意文本转成 slug。转不出任何字符时返回空串（例如纯中文），
 * 由调用方决定回退（通常是先让模型给出英文名）。
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // 去掉组合用变音符号：é → e，ñ → n
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // 撇号直接删掉而不是变成分隔符：don't → dont，而不是 don_t
    .replace(/['’‘]/g, '')
    // 其余非字母数字一律当作分隔符
    .replace(/[^a-z0-9]+/g, '_')
    // 连续分隔符合并
    .replace(/_{2,}/g, '_')
    // 去掉首尾
    .replace(/^_+|_+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    // 截断后可能又留下尾部的下划线
    .replace(/^_+|_+$/g, '');
}

/**
 * 生成一个没被占用的 slug。
 *
 * 冲突时按需求追加序号：`industrial_water_pump` → `industrial_water_pump_2` → `_3` …
 * `isTaken` 由调用方提供（查数据库），因此这里不依赖任何数据层。
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const seed = base || 'product';

  if (!(await isTaken(seed))) return seed;

  // 上限只是防御：真到 999 说明有人在用同样的名字批量建商品
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${seed}_${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`无法为 "${base}" 生成唯一 slug`);
}
