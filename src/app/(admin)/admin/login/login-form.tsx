'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/admin/actions/auth';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, Field, SubmitButton, TextInput } from '@/components/admin/form';
import { useAdminT } from '@/components/admin/i18n-provider';

export function LoginForm({ dbReady }: { dbReady: boolean }) {
  const t = useAdminT();
  const [state, formAction] = useActionState(loginAction, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      {!dbReady ? (
        <Alert kind="error">
          {t.loginForm.dbMissingBefore}
          <code>DATABASE_URL</code>
          {t.loginForm.dbMissingAfter}
        </Alert>
      ) : null}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}

      <Field label={t.loginForm.email} htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="admin@example.com"
        />
      </Field>

      <Field label={t.loginForm.password} htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton pendingText={t.loginForm.signingIn} className="w-full">
        {t.loginForm.signIn}
      </SubmitButton>
    </form>
  );
}
