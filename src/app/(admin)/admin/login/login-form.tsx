'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/admin/actions/auth';
import { initialFormState } from '@/lib/admin/action-state';
import { Alert, Field, SubmitButton, TextInput } from '@/components/admin/form';

export function LoginForm({ dbReady }: { dbReady: boolean }) {
  const [state, formAction] = useActionState(loginAction, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      {!dbReady ? (
        <Alert kind="error">
          数据库尚未配置（缺少 <code>DATABASE_URL</code>），登录暂不可用。请参考 README 完成数据库初始化。
        </Alert>
      ) : null}

      {state.status === 'error' && state.message ? (
        <Alert kind="error">{state.message}</Alert>
      ) : null}

      <Field label="邮箱" htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="admin@example.com"
        />
      </Field>

      <Field label="密码" htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton pendingText="登录中…" className="w-full">
        登录
      </SubmitButton>
    </form>
  );
}
