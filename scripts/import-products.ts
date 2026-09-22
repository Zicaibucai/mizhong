/**
 * 批量导入商品（2026-09-21 一次性脚本，清单见 scripts/data/product-import-2026-09-21.json）。
 *
 * 为什么是一个脚本而不是后台页面：130 个商品逐个在后台手填不现实，而这一步
 * **没有绕开既有约束** ——
 *   - 图片走与后台上传完全相同的存储层（`getStorage().commit`），缩略图、key 规则一致；
 *   - 网址后缀走 `resolveUniqueProductSlug`，与「新建商品」同一个函数；
 *   - 译文同步仍然只由 `scripts/translation-sync.ts` / 后台驱动，这个脚本只写中文与英文；
 *   - 每一步都写审计日志（`writeAudit`，actorEmail 标为 batch-import，不冒充任何管理员）。
 *
 * 英文名**不经过翻译**：全部取自图片上印刷的英文（用户要求），中文名同理。
 *
 * 用法（在服务器 /opt/mizhong 下执行，会读 .env.local）：
 *   npx tsx scripts/import-products.ts import  [--manifest <路径>] [--source <图片目录>] [--limit N] [--dry-run]
 *   npx tsx scripts/import-products.ts status  [--manifest <路径>]
 *   npx tsx scripts/import-products.ts publish [--manifest <路径>] [--limit N]
 *
 * import 是幂等的：已经存在同 sku 的商品会跳过，重复执行不会造出重复商品。
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getStorage, buildObjectKey } from '@/lib/storage';
import { resolveUniqueProductSlug } from '@/lib/product-slug';
import { slugify } from '@/lib/slug';
import { locales, type Locale } from '@/lib/i18n/config';
import { planSync } from '@/lib/translation/state';
import { loadProductDraftState } from '@/lib/admin/product-draft-store';
import { finishProductPublish } from '@/lib/admin/finish-publish';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

const ACTOR = 'batch-import@mizhong';

interface ManifestCategory {
  slug: string;
  nameZh: string;
  nameEn: string;
}

interface ManifestProduct {
  file: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  category: string;
  /** 缺省 true；false 表示只入库不发布（图上没印名称、等人工命名的那些） */
  published?: boolean;
  note?: string;
}

interface Manifest {
  categories: ManifestCategory[];
  products: ManifestProduct[];
}

interface Options {
  command: string;
  manifest: string;
  source?: string;
  limit?: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const [command = 'status', ...rest] = argv;
  const options: Options = {
    command,
    manifest: 'scripts/data/product-import-2026-09-21.json',
    dryRun: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag === '--manifest' && value) {
      options.manifest = value;
      index += 1;
    } else if (flag === '--source' && value) {
      options.source = value;
      index += 1;
    } else if (flag === '--limit' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) options.limit = parsed;
      index += 1;
    } else if (flag === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function readManifest(file: string): Promise<Manifest> {
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw) as Manifest;
  if (!Array.isArray(parsed.products) || !Array.isArray(parsed.categories)) {
    throw new Error('清单格式不对：需要 categories 与 products 两个数组');
  }
  return parsed;
}

/** 把源图提交进素材库（与后台上传同一条路径：缩略图、key 规则都由存储层负责） */
async function storeImage(sourceFile: string) {
  const tempFile = path.join(os.tmpdir(), `mizhong-import-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  await fs.copyFile(sourceFile, tempFile);
  const storage = getStorage();
  const key = buildObjectKey('image', 'jpg');
  try {
    return await storage.commit(tempFile, key, 'image');
  } catch (error) {
    await fs.rm(tempFile, { force: true });
    throw error;
  }
}

async function ensureCategories(db: NonNullable<ReturnType<typeof getPrisma>>, categories: ManifestCategory[]) {
  const idBySlug = new Map<string, string>();
  let created = 0;

  for (const [index, category] of categories.entries()) {
    const existing = await db.productCategory.findUnique({ where: { slug: category.slug }, select: { id: true } });
    if (existing) {
      idBySlug.set(category.slug, existing.id);
      continue;
    }
    const row = await db.productCategory.create({
      data: {
        slug: category.slug,
        sortOrder: index,
        translations: {
          create: [
            { locale: 'zh' as Locale, name: category.nameZh },
            { locale: 'en' as Locale, name: category.nameEn },
          ],
        },
      },
      select: { id: true },
    });
    idBySlug.set(category.slug, row.id);
    created += 1;
  }

  return { idBySlug, created };
}

async function runImport(options: Options) {
  const db = getPrisma();
  if (!db) throw new Error('数据库不可用（DATABASE_URL 没读到）');

  const manifest = await readManifest(options.manifest);
  const sourceRoot = options.source ?? process.env.IMPORT_SOURCE_DIR ?? '/opt/mizhong-data/import-20260921';
  const { idBySlug, created: categoriesCreated } = options.dryRun
    ? { idBySlug: new Map(manifest.categories.map((c) => [c.slug, 'dry-run'])), created: 0 }
    : await ensureCategories(db, manifest.categories);

  const rows = options.limit ? manifest.products.slice(0, options.limit) : manifest.products;
  let created = 0;
  let skipped = 0;
  let unpublished = 0;
  const missingFiles: string[] = [];

  for (const [index, item] of rows.entries()) {
    const existing = await db.product.findFirst({ where: { sku: item.sku }, select: { id: true } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const sourceFile = path.join(sourceRoot, item.file);
    try {
      await fs.access(sourceFile);
    } catch {
      missingFiles.push(item.file);
      continue;
    }

    const published = item.published !== false;
    if (options.dryRun) {
      console.log(`[dry-run] ${item.sku} ${item.nameZh} / ${item.nameEn} → ${item.category}${published ? '' : '（不发布）'}`);
      created += 1;
      if (!published) unpublished += 1;
      continue;
    }

    const committed = await storeImage(sourceFile);
    const asset = await db.asset.create({
      data: {
        type: 'IMAGE',
        driver: committed.driver === 'oss' ? 'OSS' : 'LOCAL',
        key: committed.key,
        url: committed.url,
        thumbnailUrl: committed.thumbnailUrl,
        mimeType: 'image/jpeg',
        originalName: path.basename(item.file),
        width: committed.width,
        height: committed.height,
        size: committed.size,
        enabled: true,
        translations: {
          create: [
            { locale: 'zh' as Locale, alt: item.nameZh },
            { locale: 'en' as Locale, alt: item.nameEn },
          ],
        },
      },
      select: { id: true },
    });

    const slug = await resolveUniqueProductSlug(db, `${item.sku.toLowerCase()}_${slugify(item.nameEn)}`, [
      { locale: 'en', name: item.nameEn },
    ]);

    const product = await db.product.create({
      data: {
        slug,
        sku: item.sku,
        categoryId: idBySlug.get(item.category) ?? null,
        coverAssetId: asset.id,
        published,
        sortOrder: index + 1,
        translations: {
          create: [
            { locale: 'zh' as Locale, name: item.nameZh },
            { locale: 'en' as Locale, name: item.nameEn },
          ],
        },
        media: { create: [{ assetId: asset.id, role: 'GALLERY', sortOrder: 0 }] },
      },
      select: { id: true, slug: true },
    });

    await writeAudit({
      userId: null,
      actorEmail: ACTOR,
      action: 'CREATE',
      targetType: 'Product',
      targetId: product.id,
      summary: `批量导入：${item.sku} ${item.nameZh}`,
      detail: { slug: product.slug, sku: item.sku, file: item.file, published, source: 'product-import-2026-09-21' },
    });

    created += 1;
    if (!published) unpublished += 1;
  }

  console.log(
    [
      `${options.dryRun ? '（dry-run，未写库）' : ''}`,
      `新建商品 ${created}`,
      `跳过（sku 已存在）${skipped}`,
      `未发布 ${unpublished}`,
      `新建分类 ${categoriesCreated}`,
      missingFiles.length ? `缺文件 ${missingFiles.length}：${missingFiles.slice(0, 5).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  );
  if (!options.dryRun) {
    console.log('下一步：npx tsx scripts/translation-sync.ts status，然后 sync（其它语言写进草稿），最后 publish');
  }
}

async function runStatus(options: Options) {
  const db = getPrisma();
  if (!db) throw new Error('数据库不可用');

  const manifest = await readManifest(options.manifest);
  const skus = manifest.products.map((item) => item.sku);
  const products = await db.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true, published: true, draftData: true },
  });

  console.log(`清单 ${skus.length} 个，库里已有 ${products.length} 个`);
  const withDraft = products.filter((row) => row.draftData !== null).length;
  console.log(`有待发布草稿：${withDraft}`);

  const tailLocales = locales.filter((locale) => locale !== 'zh');
  let fullySynced = 0;
  let totalPending = 0;

  for (const row of products) {
    const plan = await planSync(db, 'product', row.id, tailLocales);
    if (!plan) continue;
    const pending = plan.locales.reduce((sum, entry) => sum + entry.pendingCount, 0);
    totalPending += pending;
    if (pending === 0) fullySynced += 1;
  }

  console.log(`译文齐（10 种目标语言都没有待翻字段）：${fullySynced} / ${products.length}`);
  console.log(`待翻字段总数：${totalPending}`);
}

async function runPublish(options: Options) {
  const db = getPrisma();
  if (!db) throw new Error('数据库不可用');

  const manifest = await readManifest(options.manifest);
  const rows = options.limit ? manifest.products.slice(0, options.limit) : manifest.products;
  const skus = rows.map((item) => item.sku);
  const products = await db.product.findMany({
    where: { sku: { in: skus }, published: true },
    select: { id: true, sku: true, draftData: true },
  });

  const tailLocales = locales.filter((locale) => locale !== 'zh');
  let publishedCount = 0;
  let noDraft = 0;
  const blocked: string[] = [];

  for (const row of products) {
    if (row.draftData === null) {
      noDraft += 1;
      continue;
    }

    // 与后台「发布」同一道闸门：还有任何目标语言没翻完，就不发布
    const plan = await planSync(db, 'product', row.id, tailLocales);
    if (!plan) continue;
    const pending = plan.locales.reduce((sum, entry) => sum + entry.pendingCount, 0);
    if (pending > 0) {
      blocked.push(`${row.sku}(${pending})`);
      continue;
    }

    const state = await loadProductDraftState(db, row.id);
    if (!state?.hasDraft) {
      noDraft += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(`[dry-run] 可发布 ${row.sku}`);
      publishedCount += 1;
      continue;
    }

    await finishProductPublish(db, row.id, state.draft, {
      userId: null,
      revision: plan.revision,
      jobId: null,
      kind: 'FULL',
    });
    await writeAudit({
      userId: null,
      actorEmail: ACTOR,
      action: 'PUBLISH',
      targetType: 'Product',
      targetId: row.id,
      summary: `批量导入后发布全部语言：${row.sku}`,
      detail: { sku: row.sku, revision: plan.revision, source: 'product-import-2026-09-21' },
    });
    publishedCount += 1;
  }

  console.log(
    [
      `${options.dryRun ? '（dry-run，未写库）' : ''}`,
      `已发布 ${publishedCount}`,
      `无草稿（本来就已是最新）${noDraft}`,
      blocked.length ? `因译文未齐而跳过 ${blocked.length}：${blocked.slice(0, 10).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === 'import') return runImport(options);
  if (options.command === 'status') return runStatus(options);
  if (options.command === 'publish') return runPublish(options);

  console.error('用法：import | status | publish  [--manifest <路径>] [--source <目录>] [--limit N] [--dry-run]');
  process.exit(1);
}

main().catch((error) => {
  console.error('[product-import] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
