import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getPrisma, tryDb } from '@/lib/db';
import { getDummyHash, verifyPassword } from './password';

export const SESSION_COOKIE = 'mz_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'EDITOR';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

async function requestMeta(): Promise<{ ip?: string; userAgent?: string; secure: boolean }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    return {
      ip: forwarded ? forwarded.split(',')[0]?.trim() : undefined,
      userAgent: h.get('user-agent') ?? undefined,
      secure: resolveSecureFlag(h.get('x-forwarded-proto')),
    };
  } catch {
    return { secure: false };
  }
}

/**
 * 是否给会话 Cookie 加 Secure 标记。
 *
 * 必须跟随**实际协议**而不是 NODE_ENV：站点在配置 HTTPS 之前是纯 HTTP，
 * 若此时带上 Secure，浏览器会拒绝保存/发送该 Cookie，导致登录后一切操作都被判定为未登录。
 * 反向代理（Nginx）会把 X-Forwarded-Proto 设为真实协议，客户端伪造的值会被覆盖。
 *
 * 如需强制，可用 SESSION_COOKIE_SECURE=true|false 覆盖。
 */
function resolveSecureFlag(forwardedProto: string | null): boolean {
  const override = process.env.SESSION_COOKIE_SECURE;
  if (override === 'true') return true;
  if (override === 'false') return false;
  return forwardedProto?.split(',')[0]?.trim() === 'https';
}

/** 创建登录会话：数据库存令牌哈希，浏览器只保存 HttpOnly Cookie 中的原始令牌 */
export async function createSession(userId: string): Promise<void> {
  const db = getPrisma();
  if (!db) throw new Error('数据库未配置，无法登录');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const meta = await requestMeta();

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: meta.secure,
    path: '/',
    expires: expiresAt,
  });
}

/** 读取当前登录用户（按请求缓存） */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getPrisma();
  if (!db) return null;

  try {
    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    if (!session.user.enabled) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  } catch (error) {
    console.error('[auth] session lookup failed:', error);
    return null;
  }
});

/** 退出登录：销毁数据库会话并清除 Cookie */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await tryDb((db) => db.session.deleteMany({ where: { tokenHash: hashToken(token) } }));
  }
  store.delete(SESSION_COOKIE);
}

/**
 * 校验邮箱 + 密码。
 * 账号不存在时仍执行一次哈希比较，避免通过响应时间推断账号是否存在。
 */
export async function verifyCredentials(email: string, password: string): Promise<AdminUser | null> {
  const db = getPrisma();
  if (!db) return null;

  const normalized = email.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email: normalized } });

  if (!user) {
    await verifyPassword(password, getDummyHash());
    return null;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || !user.enabled) return null;

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** 页面/布局使用：未登录跳转到登录页 */
export async function requireAdminPage(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return user;
}

/** Server Action 使用：未登录直接拒绝（错误抛出，不跳转） */
export async function requireAdminAction(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
