import { revalidatePath } from 'next/cache';
import { locales } from '@/lib/i18n/config';

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
/** 从统一的语言清单派生，加语言后新语言的首页会自动一起失效 */
const PUBLIC_LOCALES = locales;

/**
 * 缓存失效只在**请求上下文**里有意义。
 *
 * `revalidatePath` 依赖 Next 的请求级存储；在命令行（`npm run translation:sync`）
 * 或没有请求的后台任务里调用它会直接抛异常。而「补齐任务跑完自动发布」这条路径
 * 恰恰两头都会走 —— 后台点按钮时在请求里，定时/命令行补跑时不在。
 *
 * 所以这里统一兜住：失败只记一条日志。**不把异常往上抛**是有意的 ——
 * 内容已经写进数据库了，因为「清理缓存」这一步失败就让整个同步任务报错，
 * 会让人以为内容没同步成功，而实际上它成功了、只是前台要等 60 秒自然过期。
 */
function safeRevalidate(run: () => void): void {
  try {
    run();
  } catch {
    console.info('[admin] cache revalidation skipped (no request context)');
  }
}

export function revalidatePublicSite(): void {
  safeRevalidate(() => {
    revalidatePath('/', 'layout');

    for (const locale of PUBLIC_LOCALES) {
      // 正式站首页（含页头 / 页脚 / metadata —— 它们都在该 layout 下渲染）
      revalidatePath(`/${locale}`, 'layout');
      // 设计预览（独立路由组，显式点名以免被漏掉）
      revalidatePath(`/${locale}/design-preview`, 'page');
    }
  });
}

/** 商品目录与商品详情：语言前缀 + 目录页 + 详情页动态段 */
export function revalidatePublicCatalogue(): void {
  safeRevalidate(() => {
    revalidatePath('/', 'layout');

    for (const locale of PUBLIC_LOCALES) {
      revalidatePath(`/${locale}`, 'layout');
      revalidatePath(`/${locale}/design-preview`, 'page');
      revalidatePath(`/${locale}/products`, 'page');
      // 详情页是动态段，用 'page' 类型一次性覆盖该语言下所有 slug
      revalidatePath(`/${locale}/products/[slug]`, 'page');
    }
  });
}
