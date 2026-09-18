import type { PrismaClient } from '@prisma/client';
import { slugify, uniqueSlug } from '@/lib/slug';

/**
 * 为新建商品决定一个可用的 slug（网址后缀）。
 *
 * 优先级：给定值 → 英文名称 → 中文名称 → 越南语名称 → `product-<n>` 顺序号。
 * 名称里的中文/越南语经 slugify 后可能为空，所以最后一定有兜底 —— 新建流程**永远**
 * 不会因为想不出一个英文短名而卡住。
 *
 * 结果再经过唯一化（`_2`、`_3`…），把数据库唯一约束的冲突提前解决在写入之前。
 */
export async function resolveUniqueProductSlug(
  db: PrismaClient,
  requested: string,
  names: { locale: string; name: string }[] = [],
): Promise<string> {
  const fromName =
    slugify(names.find((item) => item.locale === 'en')?.name ?? '') ||
    slugify(names.find((item) => item.locale === 'zh')?.name ?? '') ||
    slugify(names.find((item) => item.locale === 'vi')?.name ?? '');

  let candidate = requested.trim() || fromName;
  if (!candidate) {
    // 名称全是中日韩等非拉丁文字时用顺序号：可读、稳定，而且一眼能看出是自动生成的
    const total = await db.product.count();
    candidate = `product_${total + 1}`;
  }

  // 唯一化交给共享实现：命名规则（下划线 + 递增序号）只写在一处
  return uniqueSlug(candidate, async (value) =>
    Boolean(await db.product.findUnique({ where: { slug: value }, select: { id: true } })),
  );
}

/**
 * 判断一个 slug 是不是系统自动生成的占位值（`product_4` 这种）。
 *
 * 新建商品时后端会先塞一个占位 slug，好让商品能立刻保存。但对「按英文名自动生成」
 * 来说，占位值**不等于**用户填过 —— 否则新建商品后怎么打英文名都不会生成 slug，
 * 只能手动点「重新生成」，这正是需求里要避免的。
 */
export function isPlaceholderSlug(slug: string): boolean {
  return /^product_?\d+$/.test(slug.trim());
}

/** 复用空草稿的时间窗口：只回收「本次操作刚刚留下的」那一条 */
const REUSE_WINDOW_MS = 30 * 60 * 1000;

/**
 * 找一个「刚刚建出来、还什么都没填」的草稿商品。
 *
 * 点「新建商品」会直接建一条草稿并打开编辑器，因此重复点击或浏览器后退
 * 都会留下空记录。这里把**刚产生的**那条复用掉，避免列表里堆一堆空草稿。
 *
 * 两点刻意的克制：
 *   - **只回收 30 分钟以内的**：否则点「新建商品」会掉进几个月前别人留下的空草稿里，
 *     那比多一行空记录更让人困惑。更早的空草稿留在列表里（显示为「未命名商品」）由人来处置。
 *   - **「空」的定义极严**：名称、封面、悬停视频、价格、起订量、图库、规格参数全为空，
 *     动过任何一项都说明有人在认真填，绝不回收。
 */
export async function findReusableEmptyDraft(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<{ id: string } | null> {
  return db.product.findFirst({
    where: {
      published: false,
      createdAt: { gte: new Date(now.getTime() - REUSE_WINDOW_MS) },
      coverAssetId: null,
      hoverVideoAssetId: null,
      priceMode: 'NEGOTIABLE',
      priceMin: null,
      priceMax: null,
      moq: null,
      media: { none: {} },
      specifications: { none: {} },
      translations: { none: { name: { not: '' } } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
}
