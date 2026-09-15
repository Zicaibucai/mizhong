'use client';

import { logoutAction } from '@/lib/admin/actions/auth';
import { useAdminT } from './i18n-provider';

export function LogoutButton() {
  const t = useAdminT();

  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-full border border-navy-300 px-4 py-1.5 text-sm text-navy-800 transition-colors hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-500"
      >
        {t.shell.signOut}
      </button>
    </form>
  );
}
