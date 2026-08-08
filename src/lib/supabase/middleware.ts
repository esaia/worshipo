import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { clientEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Refreshes the Supabase session and returns both the user and the response
 * carrying the rewritten auth cookies.
 *
 * Critically, the returned `response` must be the one the middleware sends —
 * building a fresh NextResponse afterwards drops the refreshed cookies and logs
 * the user out roughly every hour.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser(), never getSession(): getSession() trusts the cookie without
  // verifying the JWT signature against the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response };
}
