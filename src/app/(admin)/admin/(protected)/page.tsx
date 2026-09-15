import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/session';
import { isDbConfigured, tryDb } from '@/lib/db';
import { Alert } from '@/components/admin/form';
import { AUDIT_ACTION_LABELS } from '@/lib/admin/labels';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireAdminPage();

  const stats = await tryDb(async (db) => {
    const [pages, published, drafts, products, assets, inquiries, recent] = await Promise.all([
      db.page.count(),
      db.page.count({ where: { status: 'PUBLISHED' } }),
      db.page.count({ where: { status: 'DRAFT' } }),
      db.product.count(),
      db.asset.count(),
      db.inquiry.count(),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          targetType: true,
          summary: true,
          actorEmail: true,
          createdAt: true,
        },
      }),
    ]);
    return { pages, published, drafts, products, assets, inquiries, recent };
  });

  const cards = [
    { label: '页面总数', value: stats?.pages },
    { label: '已发布页面', value: stats?.published },
    { label: '草稿页面', value: stats?.drafts },
    { label: '产品数量', value: stats?.products },
    { label: '素材数量', value: stats?.assets },
    { label: '询盘数量', value: stats?.inquiries },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">控制台</h1>
        <p className="mt-1 text-sm text-muted">网站内容概览与最近操作记录。</p>
      </header>

      {!isDbConfigured() ? (
        <Alert kind="error">
          数据库尚未配置（缺少 <code>DATABASE_URL</code>）。统计与内容管理暂不可用；前台会回退到内置文案，
          站点仍可正常访问。请参考 README 完成数据库初始化。
        </Alert>
      ) : !stats ? (
        <Alert kind="error">无法连接数据库，统计数据暂不可用。请检查数据库服务与连接串。</Alert>
      ) : null}

      <section aria-label="统计" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-navy-200 bg-white p-5">
            <p className="text-xs text-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-900">
              {card.value ?? '—'}
            </p>
          </div>
        ))}
      </section>

      <section
        aria-label="最近操作记录"
        className="rounded-xl border border-navy-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-navy-900">最近操作记录</h2>
          <Link href="/admin/audit" className="text-sm text-copper-700 hover:underline">
            查看全部
          </Link>
        </div>
        {stats?.recent.length ? (
          <ul className="divide-y divide-navy-100">
            {stats.recent.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-20 shrink-0 font-medium text-navy-800">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-navy-700">{entry.summary ?? entry.targetType}</span>
                <span className="ml-auto text-xs text-muted">
                  {entry.actorEmail ?? '—'} · {entry.createdAt.toLocaleString('zh-CN')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">暂无操作记录。</p>
        )}
      </section>
    </div>
  );
}
