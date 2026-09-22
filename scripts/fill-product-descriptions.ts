/**
 * 填充商品一句话说明（2026-09-22，配合 Bug 修复「产品详情内容太薄」）。
 *
 * 只写**中文**：写入后该字段在同步引擎眼里就是「新内容」，由既有的
 * `scripts/translation-sync.ts sync` 译成其余 9 种语言，再由发布动作上线 ——
 * 不绕过任何既有约束，也不在这里生成译文。
 *
 * 说明文字全部依据商品名、分类与产品照片所表达的事实撰写，**不编造**尺寸、克重、
 * 材质等级等具体参数；那些字段（规格表、MOQ、包装）需要业务方提供数据后单独填。
 *
 * 用法：
 *   npx tsx scripts/fill-product-descriptions.ts [--file <清单>] [--dry-run] [--overwrite]
 *   默认只填空的（已有说明不动）；--overwrite 才覆盖。
 */
import fs from 'node:fs/promises';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

interface Manifest {
  descriptions: Record<string, string>;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const overwrite = args.includes('--overwrite');
  const fileIndex = args.indexOf('--file');
  const file = fileIndex >= 0 ? args[fileIndex + 1] : 'scripts/data/product-descriptions-2026-09-22.json';

  const manifest = JSON.parse(await fs.readFile(file, 'utf8')) as Manifest;
  const entries = Object.entries(manifest.descriptions);

  const db = getPrisma();
  if (!db) throw new Error('数据库不可用');

  let filled = 0;
  let kept = 0;
  const missing: string[] = [];

  for (const [sku, text] of entries) {
    const product = await db.product.findFirst({
      where: { sku },
      select: { id: true, translations: { where: { locale: 'zh' }, select: { shortDescription: true } } },
    });
    if (!product) {
      missing.push(sku);
      continue;
    }

    const current = product.translations[0]?.shortDescription?.trim() ?? '';
    if (current && !overwrite) {
      kept += 1;
      continue;
    }
    if (current === text) {
      kept += 1;
      continue;
    }

    if (dryRun) {
      console.log(`${sku}  ${current ? '（覆盖）' : ''}${text}`);
      filled += 1;
      continue;
    }

    await db.productTranslation.update({
      where: { productId_locale: { productId: product.id, locale: 'zh' } },
      data: { shortDescription: text },
    });
    await writeAudit({
      userId: null,
      actorEmail: 'batch-import@mizhong',
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: `补充产品说明：${sku}`,
      detail: { sku, source: 'product-descriptions-2026-09-22', overwrote: Boolean(current) },
    });
    filled += 1;
  }

  console.log(
    `\n${dryRun ? '（dry-run）' : ''}写入说明 ${filled} 个，跳过（已有说明）${kept} 个${
      missing.length ? `，未找到 ${missing.length}：${missing.slice(0, 8).join(', ')}` : ''
    }`,
  );
  if (!dryRun && filled > 0) {
    console.log('下一步：npx tsx scripts/translation-sync.ts sync（译成其余 9 种语言，写进草稿）');
    console.log('         npx tsx scripts/import-products.ts publish（把草稿发布上线）');
  }
}

main().catch((error) => {
  console.error('[fill-descriptions] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
