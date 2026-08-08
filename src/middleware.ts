import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/**
 * Routes that require a session. Everything else — the songbook itself — is
 * public and needs no account.
 *
 * Deny-listing rather than allow-listing is the right way round here precisely
 * because the site is public by default: a new public page needs no change,
 * and a new private one is a deliberate addition to this list.
 */
const PRIVATE_PREFIXES = ['/users', '/categories', '/settings'];

/** Admin-only sub-paths of the otherwise public /songs section. */
const PRIVATE_SONG_PATTERNS = [
  /^\/songs\/new$/,
  /^\/songs\/[^/]+\/edit$/,
  /^\/songs\/[^/]+\/versions\//,
];

function isPrivate(pathname: string) {
  return (
    PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PRIVATE_SONG_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

/**
 * Session refresh + coarse routing only.
 *
 * This is NOT the authorization check. Role gates live in `requireAdmin()` at
 * the page level and in RLS at the data level, both of which hold even if this
 * matcher is misconfigured.
 */
export async function middleware(request: NextRequest) {
  // Runs on every matched request, signed in or not: an admin browsing public
  // pages still needs their token refreshed before it expires.
  const { user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && isPrivate(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve the destination so login can bounce the admin back to it.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/songs';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth cookies must be
     * refreshed on real navigations, not on every .css request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
