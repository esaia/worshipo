-- =============================================================================
-- Worshipo — 0004 — lock down function execution
--
-- Postgres grants EXECUTE to PUBLIC on every newly created function. The
-- explicit `grant ... to authenticated` in migration 0003 therefore added
-- nothing — anon could already call every one of them.
--
-- Verified against the live project: an anonymous request to
-- /rest/v1/rpc/find_similar_songs returned 200, not 403.
--
-- Nothing was actually exposed (both functions are SECURITY INVOKER, so they
-- see only what the caller's RLS policies allow, and song titles are public).
-- But the grants did not say what the code claimed they said, and that gap is
-- what turns into a real leak the day someone adds a SECURITY DEFINER helper.
-- =============================================================================

revoke execute on function public.search_songs(text, uuid[], int, int) from public;
revoke execute on function public.find_similar_songs(text, int)        from public;
revoke execute on function public.build_prefix_tsquery(text)           from public;

-- Public songbook: anyone may search.
grant execute on function public.search_songs(text, uuid[], int, int) to anon, authenticated;
grant execute on function public.build_prefix_tsquery(text)           to anon, authenticated;

-- Duplicate detection is an authoring aid. Admin-only in practice; signed-in is
-- the granularity available at the grant level, and RLS covers the rest.
grant execute on function public.find_similar_songs(text, int) to authenticated;

-- Belt and braces on the one function whose answer is a privilege decision.
revoke execute on function public.is_admin() from public, anon;
grant   execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Stop the next function from inheriting the same default.
-- Applies only to functions created later by this role.
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;
