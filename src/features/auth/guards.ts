import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/domain';

/**
 * The session user, or null.
 *
 * Wrapped in React `cache` so a page that calls this from the layout, the page,
 * and three components still issues one auth check and one profile query per
 * render pass.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('id', user.id)
    .single();

  return data ?? null;
});

/** Redirects to /login if signed out. Use in every authenticated page/layout. */
export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Redirects non-admins away. Use at the top of every admin page and every
 * admin Server Action — an action is a public endpoint regardless of which UI
 * renders the button that calls it.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== 'admin') redirect('/songs');
  return profile;
}
