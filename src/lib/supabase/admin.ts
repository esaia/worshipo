import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { clientEnv, serverEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role client. BYPASSES RLS ENTIRELY.
 *
 * Only two things legitimately need it:
 *   1. Auth Admin API (creating and deleting users) — there is no user-scoped
 *      equivalent, by design.
 *   2. Reading auth.users, which is not exposed to the anon key at all.
 *
 * Every call site must be behind `requireAdmin()`. The `server-only` import
 * above turns an accidental client import into a build error rather than a
 * leaked key in the browser bundle.
 *
 * Lazy singleton: constructing at module scope would read the secret during
 * `next build` even for routes that never touch it.
 */
let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAdminClient() {
  if (!client) {
    client = createSupabaseClient<Database>(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv().SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return client;
}
