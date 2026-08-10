import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { canEdit, isAdmin, type Profile } from '@/types/domain';

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

/**
 * True when the account can actually sign in with a password.
 *
 * A Google-only account has just the `google` identity, so offering it a
 * "change your password" form would be offering to change something it does
 * not have. Read from identities rather than from `app_metadata.provider`,
 * which names only the most recent sign-in method.
 */
export const hasPasswordIdentity = cache(async (): Promise<boolean> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.identities?.some((identity) => identity.provider === 'email') ?? false;
});

/** Redirects to /login if signed out. Use in every authenticated page/layout. */
export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Redirects anyone who cannot author the songbook. Admins and co-admins pass.
 *
 * This is the gate for songs, versions and categories. Use it at the top of
 * every editing page and every editing Server Action — an action is a public
 * endpoint regardless of which UI renders the button that calls it.
 */
export async function requireEditor(): Promise<Profile> {
  const profile = await requireUser();
  if (!canEdit(profile)) redirect('/songs');
  return profile;
}

/**
 * Stricter: user management only. A co-admin is bounced here exactly as a
 * member is, which is the whole difference between the two roles.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (!isAdmin(profile)) redirect('/songs');
  return profile;
}
