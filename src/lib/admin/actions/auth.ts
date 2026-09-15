'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDbConfigured } from '@/lib/db';
import { createSession, destroySession, getCurrentUser, verifyCredentials, type AdminUser } from '@/lib/auth/session';
import { checkRateLimit, clearRateLimit, recordFailure } from '@/lib/auth/rate-limit';
import { writeAudit } from '@/lib/audit';
import { makeLoginSchema } from '@/lib/admin/validation';
import { formatMessage, getAdminMessagesForRequest } from '@/lib/admin/i18n';
import type { FormState } from '@/lib/admin/action-state';

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const parsed = makeLoginSchema(t).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? t.validation.invalidInput };
  }

  if (!isDbConfigured()) {
    console.error('[admin] login attempted but DATABASE_URL is not configured');
    return { status: 'error', message: t.actions.dbNotConfiguredLogin };
  }

  const { email, password } = parsed.data;
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limitKey = `${ip}:${email.toLowerCase()}`;

  const limit = checkRateLimit(limitKey);
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return {
      status: 'error',
      message: formatMessage(t.actions.tooManyAttempts, { minutes }),
    };
  }

  let user: AdminUser | null = null;
  try {
    user = await verifyCredentials(email, password);
  } catch (error) {
    console.error('[admin] credential verification failed:', error);
    return { status: 'error', message: t.actions.signInUnavailable };
  }

  if (!user) {
    recordFailure(limitKey);
    await writeAudit({
      action: 'LOGIN_FAILED',
      targetType: 'User',
      actorEmail: email,
      summary: t.auditSummaries.loginFailed,
    });
    // Use a single error message so we never reveal whether the account exists
    return { status: 'error', message: t.actions.incorrectCredentials };
  }

  clearRateLimit(limitKey);
  await createSession(user.id);
  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action: 'LOGIN',
    targetType: 'User',
    targetId: user.id,
    summary: t.auditSummaries.signedIn,
  });

  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  const { t } = await getAdminMessagesForRequest();
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await writeAudit({
      userId: user.id,
      actorEmail: user.email,
      action: 'LOGOUT',
      targetType: 'User',
      targetId: user.id,
      summary: t.auditSummaries.signedOut,
    });
  }

  redirect('/admin/login');
}
