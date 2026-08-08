import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { clientEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Server client for RSC, Server Actions and Route Handlers.
 *
 * Uses the anon key on purpose: requests carry the user's session cookie, so
 * RLS applies exactly as it does in the browser. Anything that must bypass RLS
 * uses `supabaseAdmin` instead, and says so explicitly.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Safe to ignore: middleware
            // already refreshed the session for this request.
          }
        },
      },
    },
  );
}
