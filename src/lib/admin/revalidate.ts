import { revalidatePath } from 'next/cache';

/**
 * 后台写入后的前台缓存失效入口。
 *
 * 现状与真正原因（读完 src 里全部 29 处 revalidatePath 之后确认）：
 *   - 前台没有任何 `fetch()`、`unstable_cache`、`revalidateTag`，因此**不存在**
 *     Data Cache 层面的陈旧数据；唯一的缓存层是 Next 的 Full Route Cache：
 *       · 正式站 `src/app/(site)/[locale]/layout.tsx` 声明了 `export const revalidate = 60`
 *         —— 页面被预渲染成静态产物，最多 60 秒才自然过期；
 *       · 设计预览是 `force-dynamic`，本来就不缓存，但它的路由组
 *         `(preview)/[locale]/layout.tsx` 是**另一个根布局**，只写 `revalidatePath('/', 'layout')`
 *         时是否覆盖到它并不直观。
 *   - `getSiteContent` 的 React `cache()` 是**每请求**去重，不是跨请求缓存，不需要失效。
 *
 * 所以这里做两件事：
 *   1. 保留 `revalidatePath('/', 'layout')` —— 一次性清掉整棵路由树，覆盖面最广；
 *   2. 再按语言显式点名正式首页与设计预览。显式路径不依赖任何关于根布局归属的推断，
 *      即便将来路由组结构调整，三语首页与预览页也一定被清掉。
 *
 * 由 Server Action 调用时，失效是同步生效的 —— 后台点保存后立刻刷新前台即可看到新内容，
 * 不需要等 60 秒，也不需要重新部署。
 */
const PUBLIC_LOCALES = ['zh', 'en', 'vi'] as const;

export function revalidatePublicSite(): void {
  revalidatePath('/', 'layout');

  for (const locale of PUBLIC_LOCALES) {
    // 正式站首页（含页头 / 页脚 / metadata —— 它们都在该 layout 下渲染）
    revalidatePath(`/${locale}`, 'layout');
    // 设计预览（独立路由组，显式点名以免被漏掉）
    revalidatePath(`/${locale}/design-preview`, 'page');
  }
}

/** 商品目录与商品详情：语言前缀 + 目录页 + 详情页动态段 */
export function revalidatePublicCatalogue(): void {
  revalidatePublicSite();

  for (const locale of PUBLIC_LOCALES) {
    revalidatePath(`/${locale}/products`, 'page');
    // 详情页是动态段，用 'layout' 类型一次性覆盖该语言下所有 slug
    revalidatePath(`/${locale}/products/[slug]`, 'page');
  }
}
