import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { tryDb } from '@/lib/db';
import { Alert } from '@/components/admin/form';
import { PAGE_STATUS_LABELS } from '@/lib/admin/labels';

export const dynamic = 'force-dynamic';

export default async function AdminPagesListPage() {
  await requireAdminPage();

  const pages = await tryDb((db) =>
    db.page.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { translations: true, _count: { select: { blocks: true } } },
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">页面与区块</h1>
        <p className="mt-1 text-sm text-muted">
          管理页面信息（标题、slug、SEO）与首页各区块内容。草稿状态下前台使用内置文案。
        </p>
      </header>

      {pages === null ? (
        <Alert kind="error">数据库不可用，无法读取页面。</Alert>
      ) : null}

      {pages?.length === 0 ? (
        <Alert kind="info">
          尚无页面数据。请先执行 <code>npm run db:seed</code> 导入首页初始内容。
        </Alert>
      ) : null}

      {pages?.length ? (
        <div className="overflow-hidden rounded-xl border border-navy-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-xs uppercase tracking-wide text-navy-600">
              <tr>
                <th className="px-5 py-3 font-medium">页面</th>
                <th className="px-5 py-3 font-medium">slug</th>
                <th className="px-5 py-3 font-medium">区块</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {pages.map((page) => (
                <tr key={page.id}>
                  <td className="px-5 py-3.5 font-medium text-navy-900">
                    {page.translations.find((t) => t.locale === 'zh')?.title ??
                      page.translations[0]?.title ??
                      '（未命名）'}
                    {page.isHome ? (
                      <span className="ml-2 rounded-full bg-copper-100 px-2 py-0.5 text-xs text-copper-700">
                        首页
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-navy-600">{page.slug}</td>
                  <td className="px-5 py-3.5 text-navy-600">{page._count.blocks}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={
                        page.status === 'PUBLISHED'
                          ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700'
                          : 'rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700'
                      }
                    >
                      {PAGE_STATUS_LABELS[page.status] ?? page.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/admin/pages/${page.id}`}
                      className="text-sm text-copper-700 hover:underline"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
