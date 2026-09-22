/**
 * 一次性修正：英文产品名重复（2026-09-22）。
 *
 * 背景：导入时的英文名一律取图片上印刷的文字，而同一类产品在图上印的是同一个
 * 类名 —— 于是「圆形／雨滴／三角／半圆／造型条／发泡垫边」六个不同产品全叫
 * Styrofoam Edge Rope，14 组共 40 个商品重名。对海外客户来说无法区分，
 * 页面标题也几乎一样。
 *
 * 处理原则两条：
 *   1. **中文名不同的**：英文名在保留图上类名的前提下补上区分词（形状/材质/用途），
 *      例如 圆形垫边 → Round Styrofoam Edge Rope。这些区分信息来自产品照片与中文名，
 *      不是从中文翻译来的 —— 仍然属于「按图里的来」，只是把图上没写全的部分补足。
 *   2. **中文名相同的**（同一件货的不同规格，如 合金扣 ×3、塑皮夹仔 ×3、胶合条 ×2）：
 *      名称本就该相同，**不改名** —— 靠型号区分（详情页已显示 SKU，卡片见
 *      `product-card.tsx` 的型号行）。
 *
 * 只改 `en`：其余 9 种语言的名称是从**中文**译出的，中文名不同 → 那些语言本来就不重复。
 * 中文名一律不动，因此不会触发任何重新翻译。
 *
 * 用法：
 *   npx tsx scripts/fix-duplicate-english-names.ts --dry-run
 *   npx tsx scripts/fix-duplicate-english-names.ts
 */
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

/** sku → 新的英文名 */
const RENAMES: Record<string, { zh: string; nameEn: string }> = {
  // 垫边与滚边：图上都是 Styrofoam Edge Rope，靠形状区分
  HD6001: { zh: '圆形垫边', nameEn: 'Round Styrofoam Edge Rope' },
  HD6002: { zh: '雨滴垫边', nameEn: 'Teardrop Styrofoam Edge Rope' },
  HD6003: { zh: '三角垫边', nameEn: 'Triangle Styrofoam Edge Rope' },
  HD6004: { zh: '半圆垫边', nameEn: 'Half-Round Styrofoam Edge Rope' },
  HD6005: { zh: '造型条', nameEn: 'Shaped Styrofoam Edge Rope' },
  HD6006: { zh: '发泡垫边', nameEn: 'Foamed Styrofoam Edge Rope' },
  HD6008: { zh: '中尾造型条', nameEn: 'Mid-Tail Shaped Edge Rope' },
  HD6009: { zh: '框围垫边', nameEn: 'Frame Surround Edge Rope' },

  // 面料：图上的 None-Woven fabric 对「网眼布」本来就是错的，按实际产品给名
  HD6039: { zh: '无纺布', nameEn: 'Non-Woven Fabric' },
  HD6047: { zh: '网眼布', nameEn: 'Mesh Fabric' },
  HD6075: { zh: '无纺布带', nameEn: 'Non-Woven Fabric Tape' },

  // 弹簧：图上三种都是 No-Sag Spring，按形状区分
  HT5001: { zh: '弓簧', nameEn: 'No-Sag Bow Spring' },
  HT5003: { zh: '盘簧', nameEn: 'No-Sag Spiral Spring' },
  HT5004: { zh: '平簧', nameEn: 'No-Sag Flat Spring' },

  // 弹簧夹：纸皮 / 铁框对应不同包覆材料
  HT5018: { zh: '纸皮夹仔', nameEn: 'Paper-Covered Metal Spring Clip' },
  HT5019: { zh: '铁框夹仔', nameEn: 'Iron-Frame Metal Spring Clip' },

  // 五金件：图上统一写 brace，按实际零件给名
  HT5034: { zh: '塑料脚钉', nameEn: 'Plastic Foot Nail' },
  HT5039: { zh: '中撑板', nameEn: 'Center Support Brace' },
  HT5040: { zh: '铁框架', nameEn: 'Metal Frame Brace' },
  HT5043: { zh: '沙发支撑脚', nameEn: 'Sofa Support Leg' },
  HT5037: { zh: '钩环', nameEn: 'Tie Down Ring' },
  HT5038: { zh: '钩扣', nameEn: 'Tie Down Hook' },
  HT5041: { zh: '床挂钩', nameEn: 'Sectional Connector Hook' },
  HT5042: { zh: '床挂', nameEn: 'Sectional Connector Bracket' },

  // 棉绳 / 布料 / 纽扣 / 线材
  HD6018: { zh: '纯棉绳', nameEn: 'Pure Cotton Welt Cord' },
  HD6019: { zh: '涤棉线绳', nameEn: 'Polyester-Cotton Welt Cord' },
  HD6038: { zh: '魔术布', nameEn: 'Magic Muslin Cloth' },
  HD6046: { zh: '全棉布', nameEn: 'Pure Cotton Muslin' },
  HD6055: { zh: '三孔底扣', nameEn: 'Three-Hole Tufting Button Fastener' },
  HD6082: { zh: '单孔纽扣', nameEn: 'Single-Hole Tufting Button' },
  HD6064: { zh: '高缝线', nameEn: 'Heavy-Duty Sewing Thread' },
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = getPrisma();
  if (!db) throw new Error('数据库不可用');

  let changed = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const [sku, target] of Object.entries(RENAMES)) {
    const product = await db.product.findFirst({
      where: { sku },
      select: { id: true, translations: { select: { locale: true, name: true } } },
    });
    if (!product) {
      missing.push(sku);
      continue;
    }

    const en = product.translations.find((row) => row.locale === 'en');
    const zh = product.translations.find((row) => row.locale === 'zh');
    if (!en) {
      missing.push(`${sku}(无 en)`);
      continue;
    }
    if (en.name === target.nameEn) {
      skipped += 1;
      continue;
    }

    console.log(`${sku}  ${zh?.name ?? '?'}  →  en: "${en.name}" ⇒ "${target.nameEn}"`);
    if (dryRun) {
      changed += 1;
      continue;
    }

    await db.productTranslation.update({
      where: { productId_locale: { productId: product.id, locale: 'en' } },
      data: { name: target.nameEn },
    });
    await writeAudit({
      userId: null,
      actorEmail: 'batch-import@mizhong',
      action: 'UPDATE',
      targetType: 'Product',
      targetId: product.id,
      summary: `英文名去重：${sku} → ${target.nameEn}`,
      detail: { sku, from: en.name, to: target.nameEn, source: 'fix-duplicate-english-names' },
    });
    changed += 1;
  }

  console.log(
    `\n${dryRun ? '（dry-run）' : ''}改名 ${changed} 个，已是目标名 ${skipped} 个${
      missing.length ? `，未找到 ${missing.length}：${missing.join(', ')}` : ''
    }`,
  );
  if (!dryRun) {
    console.log('英文名不影响中文，也不会触发重新翻译（其它语言的名字来自中文）。');
  }
}

main().catch((error) => {
  console.error('[fix-names] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
