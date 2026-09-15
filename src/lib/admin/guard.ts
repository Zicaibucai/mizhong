import { requireAdminAction, type AdminUser } from '@/lib/auth/session';
import type { FormState } from './action-state';

export const UNAUTHORIZED_STATE: FormState = {
  status: 'error',
  message: '登录状态已失效，请重新登录后再试。',
};

export const DB_UNAVAILABLE_STATE: FormState = {
  status: 'error',
  message: '数据库不可用，操作未生效。请检查 DATABASE_URL 与数据库服务。',
};

/** Server Action 权限守卫：未登录或会话失效时返回错误状态，不抛异常给用户 */
export async function requireAdminOrError(): Promise<{ user: AdminUser } | { error: FormState }> {
  try {
    const user = await requireAdminAction();
    return { user };
  } catch {
    return { error: UNAUTHORIZED_STATE };
  }
}
