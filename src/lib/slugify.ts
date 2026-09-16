/**
 * 由产品名称生成 slug 建议。
 *
 * 只做「建议」：管理员随时可以手动改成别的值，一旦手动改过就不再覆盖。
 * 规则与后端校验（`^[a-z0-9]+(?:-[a-z0-9]+)*$`）保持一致，
 * 因此建议值永远是合法 slug，不会出现「自动填了一个保存不了的值」。
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // 去掉组合用的变音符号（é → e）
    .replace(/̀-ͯ/gu, '')
    .toLowerCase()
    // 任何非 ASCII 字母数字（中日韩、越南语声调符号等）都当作分隔符
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}
