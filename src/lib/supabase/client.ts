import { createBrowserClient } from '@supabase/ssr';

import { clientEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Browser client. Carries the user's JWT, so every query runs under RLS.
 *
 * `createBrowserClient` memoises internally, so calling this per component is
 * cheap and avoids a module-level singleton that would leak between users
 * during dev fast-refresh.
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
