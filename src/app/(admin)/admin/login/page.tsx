import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isDbConfigured } from '@/lib/db';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '登录 · 后台管理',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/admin');

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-5 py-12 texture-weave-dark">
      <div className="w-full max-w-sm rounded-2xl border border-navy-800 bg-ivory-50 p-8 shadow-xl shadow-navy-950/30">
        <h1 className="text-lg font-semibold tracking-tight text-navy-900">米众贸易有限公司</h1>
        <p className="mt-1 text-sm text-muted">内容管理后台登录</p>
        <div className="mt-7">
          <LoginForm dbReady={isDbConfigured()} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-navy-400">
          仅限授权管理员访问。未开通自助注册，账号由
          <code className="mx-1 rounded bg-navy-100 px-1 py-0.5">npm run admin:create</code>
          创建。
        </p>
      </div>
    </div>
  );
}
