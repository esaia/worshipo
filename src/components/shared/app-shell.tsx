import type { ReactNode } from 'react';

import { BottomNav } from './bottom-nav';
import type { Profile } from '@/types/domain';

/**
 * Authenticated layout frame. Server Component — only the nav needs client JS.
 *
 * `pb-20` reserves room for the fixed bottom bar so the last row of a list is
 * never trapped underneath it.
 */
export function AppShell({ profile, children }: { profile: Profile | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:pl-56">
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 md:px-8 md:pb-12">{children}</main>
      <BottomNav profile={profile} />
    </div>
  );
}
