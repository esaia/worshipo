import type { ReactNode } from 'react';

import { AppShell } from '@/components/shared/app-shell';
import { getSessionProfile } from '@/features/auth/guards';

/**
 * The public shell. `profile` is null for visitors — this layout deliberately
 * does not guard anything.
 *
 * Private pages call `requireAdmin()` / `requireUser()` themselves. Putting the
 * guard here instead would be one line shorter and would lock the whole
 * songbook behind a login.
 *
 * `getSessionProfile` is React-cached, so a child page calling `requireAdmin()`
 * reuses this lookup rather than issuing a second one.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();

  return <AppShell profile={profile}>{children}</AppShell>;
}
