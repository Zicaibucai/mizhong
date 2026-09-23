/**
 * JSON-LD 结构化数据的**唯一渲染点**。
 *
 * 全仓只允许这一处使用 `dangerouslySetInnerHTML`（由 `no-html-injection` 测试盯着）：
 * 结构化数据必须输出原始 JSON，而 JSON 里的 `<` 必须转义成 `<` ——
 * 否则内容中出现 `</script>` 会提前闭合标签，把它后面的 JSON 变成可执行的 HTML。
 *
 * 需要新的结构化数据时（商品、组织、站点、面包屑…）都用这个组件，
 * 不要在各页面里各写一遍 `<script type="application/ld+json">`。
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
