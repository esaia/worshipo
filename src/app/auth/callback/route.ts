import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * OAuth landing point. Google redirects here with `?code=`, which is worth
 * nothing until it is exchanged — server-side, against the PKCE verifier that
 * `signInWithOAuth` left in a cookie — for a session.
 *
 * A Route Handler and not a page: this must set cookies, which a Server
 * Component cannot do.
 */
function safeNext(next: string | null): string {
  // Same rule as the password login: an absolute or protocol-relative `next`
  // would turn the callback into an open redirect for anyone who can craft a
  // link to it.
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/songs';
  return next;
}

/**
 * Behind a load balancer the request Next.js sees is http://localhost:3000, so
 * `nextUrl.origin` would redirect the user off the public hostname and onto the
 * container. `x-forwarded-host` is what the proxy actually received.
 */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost || process.env.NODE_ENV === 'development') return request.nextUrl.origin;

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${forwardedHost}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  // Google reports a refused consent screen as ?error=access_denied. Nothing
  // went wrong, so it should read as a cancelled sign-in, not a failure.
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
