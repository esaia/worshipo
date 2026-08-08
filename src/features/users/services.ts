import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

export type UserListItem = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'name' | 'role' | 'created_at'
>;

/**
 * Reads through the *user's* client, not the admin client: profiles are
 * readable by any authenticated user under RLS, so there is no reason to
 * bypass policies here.
 */
export async function listUsers(): Promise<UserListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, created_at')
    .order('role')
    .order('name');

  if (error) throw new Error(`Could not load users: ${error.message}`);
  return data;
}
