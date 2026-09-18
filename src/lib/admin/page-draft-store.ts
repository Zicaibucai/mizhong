import { Prisma, type PrismaClient } from '@prisma/client';
import { ADMIN_LOCALES } from '@/lib/admin/validation';
import { recordSlugChange } from '@/lib/slug-history';
import { pageDraftFromRow } from '@/lib/translation/adapters';
import { readPageDraft, type PageBlockDraft, type PageDraft } from '@/lib/page-draft';

/**
 * 页面草稿与版本的数据访问层 —— 与 `product-draft-store.ts` 同一套做法。
 *
 * 页面（含首页）过去是**直接写线上**的：点保存的那一刻访客就看到了半截改动。
 * 这里把它改成与商品一致的两段式：编辑落进 `Page.draftData`，发布才写关系表。
 *
 * 放在一处是为了让「线上内容长什么样」只有一份定义 —— 任何地方手工拼一遍，
 * 都会在字段增删时静默漏掉一个。
 */

/** 发布/存档后每个页面最多保留的历史版本数（与商品一致） */
export const MAX_PAGE_VERSIONS = 3;

/** 与商品共用同一份事务设置，理由见 product-draft-store 的注释 */
export const PAGE_TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

export interface PageDraftState {
  live: PageDraft;
  draft: PageDraft;
  hasDraft: boolean;
  /** 线上是否已发布 */
  published: boolean;
  draftUpdatedAt: Date | null;
  /** 页面主键 —— 首页也是普通页面，只是 isHome 为真 */
  pageId: string;
}

const PAGE_INCLUDE = {
  translations: true,
  blocks: {
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    include: { translations: true },
  },
} satisfies Prisma.PageInclude;

type PageWithRelations = Prisma.PageGetPayload<{ include: typeof PAGE_INCLUDE }>;

/**
 * 读取一个页面的「线上内容 + 正在编辑的草稿」。
 *
 * `hasDraft` 是「有未发布改动」的唯一依据：发布后草稿会被清空，
 * 所以「draftData 非空」与「有待发布的改动」是同一件事。
 */
export async function loadPageDraftState(
  db: PrismaClient | Prisma.TransactionClient,
  pageId: string,
): Promise<PageDraftState | null> {
  const row = await db.page.findUnique({ where: { id: pageId }, include: PAGE_INCLUDE });
  if (!row) return null;

  const live = pageDraftFromRow(row as PageWithRelations);
  const stored = readPageDraft(row.draftData);
  return {
    live,
    draft: stored ?? live,
    hasDraft: stored !== null,
    published: row.status === 'PUBLISHED',
    draftUpdatedAt: row.draftUpdatedAt,
    pageId: row.id,
  };
}

/** 把整份草稿写回 `draftData`。传进来的永远是完整草稿，因此不会清掉别的分区。 */
export async function savePageDraft(
  db: PrismaClient | Prisma.TransactionClient,
  pageId: string,
  draft: PageDraft,
): Promise<void> {
  await db.page.update({
    where: { id: pageId },
    data: {
      draftData: draft as unknown as Prisma.InputJsonValue,
      draftUpdatedAt: new Date(),
    },
  });
}

/** 丢弃草稿（发布后调用），页面回到「没有待发布改动」的状态 */
export async function clearPageDraft(
  db: PrismaClient | Prisma.TransactionClient,
  pageId: string,
): Promise<void> {
  await db.page.update({
    where: { id: pageId },
    data: { draftData: Prisma.DbNull, draftUpdatedAt: null },
  });
}

// ---------------------------------------------------------------------------
// 发布：把草稿落进关系表
// ---------------------------------------------------------------------------

/**
 * 把一份页面草稿完整写进线上内容。
 *
 * 必须在事务里调用：发布要么整体生效，要么完全不动。
 *
 * 区块按主键**复用**而不是全删全建 —— 全删全建会让区块 id 每次都变，
 * 而译文同步状态、审计日志都按 id 引用它们。区块的译文行本身没有外部引用，
 * 所以那里先清后建最省往返（跨网络时少几十次 upsert）。
 */
export async function applyPageDraftToLive(
  tx: Prisma.TransactionClient,
  pageId: string,
  draft: PageDraft,
): Promise<void> {
  // 改过 slug 就把旧地址记下来，前台据此 301 到新地址
  const before = await tx.page.findUnique({ where: { id: pageId }, select: { slug: true } });
  if (before) await recordSlugChange(tx, 'page', pageId, before.slug, draft.slug);

  await tx.page.update({ where: { id: pageId }, data: { slug: draft.slug } });

  // 页面自身的标题与 SEO。
  //
  // 只有真正有标题的语言才建行 —— 某种语言什么都没填时若也写一行空标题，
  // 前台在该语言下会选中这一行、渲染出空白标题，而不是按设计回退。
  for (const locale of ADMIN_LOCALES) {
    const values = draft.translations[locale];
    const data = {
      title: values.title,
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
    };
    const hasAnything = Object.values(values).some((value) => value.trim().length > 0);
    if (!hasAnything) {
      await tx.pageTranslation.deleteMany({ where: { pageId, locale } });
      continue;
    }
    await tx.pageTranslation.upsert({
      where: { pageId_locale: { pageId, locale } },
      create: { pageId, locale, ...data },
      update: data,
    });
  }

  // 区块：按 id 调和
  const existingBlocks = await tx.pageBlock.findMany({ where: { pageId }, select: { id: true } });
  const existingIds = new Set(existingBlocks.map((row) => row.id));
  const keptIds: string[] = [];

  for (const [index, block] of draft.blocks.entries()) {
    const reusable = block.id !== null && existingIds.has(block.id);
    const blockId = reusable
      ? block.id!
      : (await tx.pageBlock.create({ data: { pageId, key: block.key, sortOrder: index }, select: { id: true } })).id;
    keptIds.push(blockId);

    // key 在同一页面内唯一；复用已有行时把它对齐到草稿里的值
    await tx.pageBlock.update({
      where: { id: blockId },
      data: { key: block.key, enabled: block.enabled, sortOrder: index },
    });
  }

  if (keptIds.length > 0) {
    await tx.pageBlockTranslation.deleteMany({ where: { blockId: { in: keptIds } } });

    const rows = draft.blocks.flatMap((block, index) =>
      ADMIN_LOCALES.map((locale) => ({
        blockId: keptIds[index],
        locale,
        title: block.values[locale].title.trim() || null,
        subtitle: block.values[locale].subtitle.trim() || null,
        body: block.values[locale].body.trim() || null,
        ctaLabel: block.values[locale].ctaLabel.trim() || null,
        ctaHref: block.values[locale].ctaHref.trim() || null,
      })).filter((row) => row.title || row.subtitle || row.body || row.ctaLabel || row.ctaHref),
    );
    if (rows.length > 0) await tx.pageBlockTranslation.createMany({ data: rows });
  }

  // 草稿里没有的旧区块删掉
  if (keptIds.length > 0) {
    await tx.pageBlock.deleteMany({ where: { pageId, id: { notIn: keptIds } } });
  } else {
    await tx.pageBlock.deleteMany({ where: { pageId } });
  }
}

/** 把版本快照恢复成草稿（不直接改线上，与商品一致） */
export async function restorePageVersionToDraft(
  db: PrismaClient,
  pageId: string,
  snapshot: unknown,
): Promise<PageDraft | null> {
  const draft = readPageDraft(snapshot);
  if (!draft) return null;
  await savePageDraft(db, pageId, draft);
  return draft;
}

// ---------------------------------------------------------------------------
// 版本
// ---------------------------------------------------------------------------

/**
 * 写入一个版本快照，并把该页面的历史版本裁到 MAX_PAGE_VERSIONS 个。
 *
 * `releaseId` 指向同一次发布的 ContentRelease —— 中文与各语言因此在事后
 * 仍然能证明是「同一次发布出去的」。
 */
export async function recordPageVersion(
  tx: Prisma.TransactionClient,
  input: {
    pageId: string;
    kind: 'PUBLISHED' | 'MANUAL';
    snapshot: PageDraft;
    userId: string | null;
    releaseId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.pageVersion.create({
    data: {
      pageId: input.pageId,
      kind: input.kind,
      snapshot: input.snapshot as unknown as Prisma.InputJsonValue,
      releaseId: input.releaseId ?? null,
      createdById: input.userId,
      note: input.note?.trim() || null,
    },
  });

  const keep = await tx.pageVersion.findMany({
    where: { pageId: input.pageId },
    orderBy: { createdAt: 'desc' },
    take: MAX_PAGE_VERSIONS,
    select: { id: true },
  });
  await tx.pageVersion.deleteMany({
    where: { pageId: input.pageId, id: { notIn: keep.map((row) => row.id) } },
  });
}

/** 区块 key 在一个页面里必须唯一 —— 发布前拦下来，否则数据库的唯一约束会以难懂的方式报错 */
export function duplicateBlockKeys(draft: PageDraft): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const block of draft.blocks) {
    const key = block.key.trim();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

export type { PageBlockDraft };
