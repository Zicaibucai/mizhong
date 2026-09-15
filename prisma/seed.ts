/**
 * 数据库种子：把现有三语言首页文案与公开联系方式导入数据库，避免初始化后站点变空。
 *
 * 运行：npm run db:seed
 * 幂等：可重复执行，已存在的记录不会被覆盖（管理员在后台的修改不会被冲掉）。
 *
 * 联系方式来自 src/lib/contact-config.ts（已确认的公开真实信息），
 * 同一份数据也作为数据库不可用时前台的展示回退。
 */
import { PrismaClient } from '@prisma/client';
import { loadLocalEnv } from '../scripts/load-env';
import { zh } from '../src/lib/i18n/dictionaries/zh';
import { en } from '../src/lib/i18n/dictionaries/en';
import { vi } from '../src/lib/i18n/dictionaries/vi';
import { companyName } from '../src/lib/site-config';
import { PUBLIC_CONTACTS } from '../src/lib/contact-config';

loadLocalEnv();

const prisma = new PrismaClient();

const LOCALES = ['zh', 'en', 'vi'] as const;
type SeedLocale = (typeof LOCALES)[number];

const dicts = { zh, en, vi } as const;

const BLOCK_ORDER = ['hero', 'capabilities', 'products', 'supply', 'quality', 'inquiry'] as const;
type BlockKey = (typeof BLOCK_ORDER)[number];

interface BlockSeed {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
}

function blockSeed(locale: SeedLocale): Record<BlockKey, BlockSeed> {
  const t = dicts[locale];
  return {
    hero: {
      title: `${t.hero.titleLine1}\n${t.hero.titleLine2}`,
      subtitle: t.hero.subtitle,
      ctaLabel: t.hero.ctaPrimary,
      ctaHref: '#products',
    },
    capabilities: { title: t.capabilities.title, subtitle: t.capabilities.subtitle },
    products: {
      title: t.products.title,
      subtitle: t.products.subtitle,
      ctaLabel: t.products.cta,
      ctaHref: '#inquiry',
    },
    supply: { title: t.supply.title, subtitle: t.supply.subtitle },
    quality: { title: t.quality.title, subtitle: t.quality.subtitle },
    inquiry: {
      title: t.inquiry.title,
      subtitle: t.inquiry.subtitle,
      ctaLabel: t.inquiry.cta,
      ctaHref: '',
    },
  };
}

const NAV_SEED = [
  { href: '#products', key: 'products' },
  { href: '#supply', key: 'supply' },
  { href: '#quality', key: 'quality' },
  { href: '#inquiry', key: 'contact' },
] as const;

async function seedCompanyProfile(): Promise<void> {
  const profile = await prisma.companyProfile.upsert({
    where: { slug: 'primary' },
    update: {},
    create: { slug: 'primary' },
  });

  for (const locale of LOCALES) {
    const t = dicts[locale];
    await prisma.companyProfileTranslation.upsert({
      where: { profileId_locale: { profileId: profile.id, locale } },
      update: {},
      create: {
        profileId: profile.id,
        locale,
        name: companyName(locale),
        tagline: t.footer.tagline,
        positioning: t.hero.eyebrow,
        seoDescription: t.meta.description,
      },
    });
  }

  console.log('✓ 公司资料（3 种语言）');
}

async function seedHomePage(): Promise<void> {
  const page = await prisma.page.upsert({
    where: { slug: 'home' },
    update: {},
    create: { slug: 'home', isHome: true, status: 'PUBLISHED', sortOrder: 0 },
  });

  for (const locale of LOCALES) {
    const t = dicts[locale];
    await prisma.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale } },
      update: {},
      create: {
        pageId: page.id,
        locale,
        title: t.meta.title,
        seoDescription: t.meta.description,
      },
    });
  }

  for (const [index, key] of BLOCK_ORDER.entries()) {
    const block = await prisma.pageBlock.upsert({
      where: { pageId_key: { pageId: page.id, key } },
      update: {},
      create: { pageId: page.id, key, enabled: true, sortOrder: index },
    });

    for (const locale of LOCALES) {
      const data = blockSeed(locale)[key];
      await prisma.pageBlockTranslation.upsert({
        where: { blockId_locale: { blockId: block.id, locale } },
        update: {},
        create: {
          blockId: block.id,
          locale,
          title: data.title,
          subtitle: data.subtitle,
          ctaLabel: data.ctaLabel ?? '',
          ctaHref: data.ctaHref ?? '',
        },
      });
    }
  }

  console.log(`✓ 首页与 ${BLOCK_ORDER.length} 个区块（3 种语言）`);
}

async function seedNavigation(): Promise<void> {
  const existing = await prisma.navItem.count();
  if (existing > 0) {
    console.log(`· 导航已存在 ${existing} 项，跳过`);
    return;
  }

  for (const [index, item] of NAV_SEED.entries()) {
    const nav = await prisma.navItem.create({
      data: { href: item.href, sortOrder: index, enabled: true, external: false },
    });
    for (const locale of LOCALES) {
      await prisma.navItemTranslation.create({
        data: { navItemId: nav.id, locale, label: dicts[locale].nav[item.key] },
      });
    }
  }

  console.log(`✓ 导航 ${NAV_SEED.length} 项（3 种语言）`);
}

/**
 * 联系方式：按稳定 `key` 幂等创建。
 * 已存在的记录一律不修改（管理员在后台的启用/停用、排序、文案调整都会被保留）。
 */
async function seedContacts(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const contact of PUBLIC_CONTACTS) {
    const existing = await prisma.contactMethod.findUnique({ where: { key: contact.key } });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.contactMethod.create({
      data: {
        key: contact.key,
        type: contact.type,
        value: contact.value,
        href: contact.href,
        sortOrder: contact.sortOrder,
        enabled: contact.enabled,
      },
    });
    created += 1;
  }

  const enabled = await prisma.contactMethod.count({ where: { enabled: true } });
  console.log(
    `✓ 联系方式：新建 ${created} 条，已存在跳过 ${skipped} 条（当前启用 ${enabled} 条）`,
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('✗ 未配置 DATABASE_URL。请复制 .env.example 为 .env.local 并填写连接串。');
    process.exit(1);
  }

  await seedCompanyProfile();
  await seedHomePage();
  await seedNavigation();
  await seedContacts();

  console.log('\n种子完成。');
}

main()
  .catch((error) => {
    console.error('种子执行失败：', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
