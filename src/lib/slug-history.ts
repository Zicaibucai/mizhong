import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * 旧 slug 的永久重定向。
 *
 * 管理员主动改 slug 之后，旧地址会 404 —— 而搜索引擎索引、外部链接、
 * 客户收藏夹里指着的是旧地址。这类损失是静默的：页面本身一切正常，
 * 只是那些流量悄悄落到了 404 上。
 *
 * 所以发布时若发现 slug 变过，就把旧值记下来；前台在「本来就要 404」的那条
 * 路径上查一次这张表，命中就 301 到新地址。正常访问一次额外查询都没有。
 */

export type SlugEntityType = 'product' | 'page';

/**
 * 记下 slug 的变化。**必须在发布事务里调用** —— 和 slug 的更新同生共死，
 * 否则会出现「新地址生效了、旧地址没记下来」这种事后无法补救的状态。
 *
 * 新 slug 曾被这条内容用过的话（改回去），把那条历史删掉：
 * 否则「a → b → a」之后，访问 a 会命中历史把自己重定向到自己。
 */
export async function recordSlugChange(
  tx: Prisma.TransactionClient,
  entityType: SlugEntityType,
  entityId: string,
  previousSlug: string,
  nextSlug: string,
): Promise<void> {
  const before = previousSlug.trim();
  const after = nextSlug.trim();
  if (!before || before === after) return;

  // 新地址曾经是这条内容的旧地址 → 那条记录已经没有意义了
  await tx.slugHistory.deleteMany({ where: { entityType, entityId, slug: after } });

  await tx.slugHistory.upsert({
    where: { entityType_slug: { entityType, slug: before } },
    create: { entityType, entityId, slug: before },
    // slug 已经属于这条内容时什么都不用改；属于别的内容时也不抢 ——
    // 唯一约束保证了同一个地址不会被两条内容同时认领
    update: {},
  });
}

/**
 * 查一个 slug 是不是某条内容用过的旧地址。
 *
 * 只在实体按当前 slug 查不到时调用，因此正常的每一次访问都不产生这次查询。
 */
export async function findSlugRedirect(
  db: PrismaClient,
  entityType: SlugEntityType,
  slug: string,
): Promise<string | null> {
  const clean = slug.trim();
  if (!clean) return null;

  const row = await db.slugHistory.findUnique({
    where: { entityType_slug: { entityType, slug: clean } },
    select: { entityId: true },
  });
  if (!row) return null;

  // 拿当前的真实 slug —— 内容可能又改过好几次，一次跳到最终地址比链式跳转好
  const current =
    entityType === 'product'
      ? await db.product.findUnique({ where: { id: row.entityId }, select: { slug: true, published: true } })
      : await db.page.findUnique({ where: { id: row.entityId }, select: { slug: true, status: true } });

  if (!current) return null;

  const live = entityType === 'product'
    ? (current as { slug: string; published: boolean }).published
    : (current as { slug: string; status: string }).status === 'PUBLISHED';

  // 未发布的内容不该被重定向过去 —— 那等于用一个 301 把访客送到 404
  if (!live) return null;

  return current.slug;
}
