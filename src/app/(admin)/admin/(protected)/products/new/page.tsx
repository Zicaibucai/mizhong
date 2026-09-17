import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getAdminMessagesForRequest } from '@/lib/admin/i18n';
import { findReusableEmptyDraft, resolveUniqueProductSlug } from '@/lib/product-slug';
import { Alert } from '@/components/admin/form';

export const dynamic = 'force-dynamic';

/** redirect() 用 digest 抛出 NEXT_REDIRECT；它必须原样冒泡，不能被 catch 吞掉 */
function isRedirect(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'digest' in error);
}

/**
 * 「新建商品」不再是一张只有名称和网址后缀的小表单，而是**直接开一个空商品**，
 * 然后跳进完整的商品编辑器 —— 图片、价格与贸易信息、规格参数、多语言全都在那一页，
 * 不需要先建一个壳再回头补。
 *
 * 两个细节：
 *   - **复用空草稿**：重复点击、浏览器后退、或者上次建到一半离开都会留下空草稿，
 *     这里优先复用（见 findReusableEmptyDraft），不会让商品列表堆积空记录；
 *   - **入口链接必须 prefetch={false}**：本页的一次渲染就会写入数据库，
 *     而 Next 的链接预取会在鼠标悬停时执行它；关掉预取，只有真正点击才会建。
 */
export default async function AdminNewProductPage() {
  const user = await requireAdminPage();
  const { t } = await getAdminMessagesForRequest();

  const db = getPrisma();
  if (!db) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.products.dbUnavailable}</Alert>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
      </div>
    );
  }

  let targetId: string;
  try {
    const reusable = await findReusableEmptyDraft(db);
    if (reusable) {
      targetId = reusable.id;
    } else {
      const product = await db.product.create({
        data: {
          // 网址后缀按顺序号生成，打开编辑器后随时可以改
          slug: await resolveUniqueProductSlug(db, '', []),
          published: false,
        },
        select: { id: true, slug: true },
      });
      targetId = product.id;

      await writeAudit({
        userId: user.id,
        actorEmail: user.email,
        action: 'CREATE',
        targetType: 'Product',
        targetId: product.id,
        summary: t.products.newTitle,
        detail: { slug: product.slug },
      });
    }
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error('[admin] start new product failed:', error);
    return (
      <div className="space-y-4">
        <Alert kind="error">{t.actions.saveFailed}</Alert>
        <Link href="/admin/products" className="text-sm text-copper-700 hover:underline">
          ← {t.products.title}
        </Link>
      </div>
    );
  }

  redirect(`/admin/products/${targetId}`);
}
