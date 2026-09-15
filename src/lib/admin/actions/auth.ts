'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDbConfigured } from '@/lib/db';
import { createSession, destroySession, getCurrentUser, verifyCredentials, type AdminUser } from '@/lib/auth/session';
import { checkRateLimit, clearRateLimit, recordFailure } from '@/lib/auth/rate-limit';
import { writeAudit } from '@/lib/audit';
import { loginSchema } from '@/lib/admin/validation';
import type { FormState } from '@/lib/admin/action-state';

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '请检查输入内容' };
  }

  if (!isDbConfigured()) {
    console.error('[admin] login attempted but DATABASE_URL is not configured');
    return { status: 'error', message: '数据库尚未配置，暂时无法登录。请联系系统管理员。' };
  }

  const { email, password } = parsed.data;
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limitKey = `${ip}:${email.toLowerCase()}`;

  const limit = checkRateLimit(limitKey);
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return { status: 'error', message: `登录尝试过于频繁，请约 ${minutes} 分钟后再试。` };
  }

  let user: AdminUser | null = null;
  try {
    user = await verifyCredentials(email, password);
  } catch (error) {
    console.error('[admin] credential verification failed:', error);
    return { status: 'error', message: '登录服务暂时不可用，请稍后再试。' };
  }

  if (!user) {
    recordFailure(limitKey);
    await writeAudit({
      action: 'LOGIN_FAILED',
      targetType: 'User',
      actorEmail: email,
      summary: '登录失败',
    });
    // 统一错误文案，不暴露账号是否存在
    return { status: 'error', message: '邮箱或密码不正确。' };
  }

  clearRateLimit(limitKey);
  await createSession(user.id);
  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'LOGIN',
    targetType: 'User',
    targetId: user.id,
    summary: '管理员登录',
  });

  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'LOGOUT',
      targetType: 'User',
      targetId: user.id,
      summary: '管理员退出',
    });
  }

  redirect('/admin/login');
}
