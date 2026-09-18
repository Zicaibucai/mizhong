import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * 「DeepSeek 的返回会不会注入危险 HTML」这件事的守卫。
 *
 * 结论先说：**目前没有注入路径**，因为商品的所有文本字段在前台都走 JSX 文本插值
 * （`{value}`）—— React 会把 `<script>` 这类内容原样当文字显示，不会当标签执行。
 * 也就是说项目现有的「白名单流程」就是「一律当纯文本渲染，不解析 HTML」。
 *
 * 这个测试的作用是**把这条结论钉住**：哪天有人为了做富文本，给某个内容字段加上
 * `dangerouslySetInnerHTML`，这里会立刻红，从而强制他先接一个真正的清理流程。
 *
 * 唯一允许的 HTML 注入点是 JSON-LD（结构化数据本来就必须是原始 JSON），
 * 它必须把 `<` 转义成 <，否则内容里出现 `</script>` 会提前闭合标签，
 * 把后面的 JSON 变成可执行的 HTML。
 */

const SRC = join(process.cwd(), 'src');

/** 允许使用 dangerouslySetInnerHTML 的文件及理由 */
const ALLOWED_SINKS: Record<string, string> = {
  'app/(site)/[locale]/products/[slug]/page.tsx':
    'JSON-LD 结构化数据；必须转义 < 以免 </script> 提前闭合标签',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !full.includes('__tests__')) out.push(full);
  }
  return out;
}

describe('内容字段不解析 HTML', () => {
  const files = walk(SRC);
  const sinks = files.filter((file) => readFileSync(file, 'utf8').includes('dangerouslySetInnerHTML'));

  test('扫到了源码（防止 walk 失效后测试静默通过）', () => {
    assert.ok(files.length > 100, `只扫到 ${files.length} 个文件`);
  });

  test('全仓只有一处 dangerouslySetInnerHTML，且是白名单里的 JSON-LD', () => {
    const unexpected = sinks
      .map((file) => relative(SRC, file))
      .filter((rel) => !(rel in ALLOWED_SINKS));
    assert.deepEqual(
      unexpected,
      [],
      `出现了未经审查的 HTML 注入点：\n  ${unexpected.join('\n  ')}\n` +
        '给内容字段加富文本前，必须先接一个真正的清理流程（白名单），而不是直接渲染。',
    );
  });

  test('JSON-LD 那一处确实转义了 `<`', () => {
    for (const rel of Object.keys(ALLOWED_SINKS)) {
      const source = readFileSync(join(SRC, rel), 'utf8');
      assert.match(
        source,
        /replace\(\/</g,
        `${rel} 的 dangerouslySetInnerHTML 没有转义 <，内容里的 </script> 会提前闭合标签`,
      );
    }
  });

  test('商品文本字段在前台走 JSX 文本插值，不经过 HTML 解析', () => {
    const detail = readFileSync(join(SRC, 'components/catalog/product-detail.tsx'), 'utf8');
    // overview / spec / application 都是 `{value}` 形式插值
    for (const marker of ['{overview}', '{freeTextSpec}', '{application}']) {
      assert.ok(detail.includes(marker), `product-detail.tsx 里找不到 ${marker}`);
    }
    assert.ok(
      !detail.includes('dangerouslySetInnerHTML'),
      'product-detail.tsx 出现了 HTML 注入点',
    );
  });

  test('翻译接口只回传字符串，返回值里不含任何 HTML 标记', () => {
    // 翻译的返回值结构是 Record<string, Partial<Record<field, string>>>，
    // 全部是字符串；渲染层再按纯文本处理。这里锁住「是字符串」这一契约。
    const source = readFileSync(join(SRC, 'lib/translation/fields.ts'), 'utf8');
    assert.match(source, /Partial<Record<TranslatableField, string>>/);
    assert.ok(!source.includes('dangerouslySetInnerHTML'));
  });
});
