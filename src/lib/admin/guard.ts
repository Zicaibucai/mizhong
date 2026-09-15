import { requireAdminAction, type AdminUser } from '@/lib/auth/session';
import type { AdminMessages } from './i18n';
import type { FormState } from './action-state';

/** Signed out / expired session error, in the admin's current language */
export function getUnauthorizedState(t: AdminMessages): FormState {
  return { status: 'error', message: t.actions.sessionExpired };
}

/** Database unavailable error, in the admin's current language */
export function getDbUnavailableState(t: AdminMessages): FormState {
  return { status: 'error', message: t.actions.dbUnavailable };
}

/** Server Action permission guard: returns an error state when signed out or the session expired, instead of throwing at the user */
export async function requireAdminOrError(
  t: AdminMessages,
): Promise<{ user: AdminUser } | { error: FormState }> {
  try {
    const user = await requireAdminAction();
    return { user };
  } catch {
    return { error: getUnauthorizedState(t) };
  }
}
