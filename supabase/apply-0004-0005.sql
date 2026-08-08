-- Worshipo — migrations 0004 + 0005. Run once in the Supabase SQL Editor.

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


-- =============================================================================
-- Worshipo — 0005 — fix role provisioning
--
-- Two bugs found the first time an admin was actually created.
--
-- BUG 1 — the role never arrived.
--   `handle_new_user` reads `raw_app_meta_data ->> 'role'` on AFTER INSERT.
--   GoTrue's admin API does not write custom app_metadata in that INSERT: it
--   creates the row with {"provider":"email","providers":["email"]} and merges
--   the caller's app_metadata in a follow-up UPDATE. The trigger therefore saw
--   no role and fell through to the 'user' default, silently.
--
-- BUG 2 — the fix-by-hand path was locked.
--   `guard_profile_role` raises unless `is_admin()`, and `is_admin()` reads
--   `auth.uid()`, which is NULL in the SQL editor, in the Table Editor, and for
--   the service role. So the guard blocked exactly the contexts that legitimately
--   administer roles, while a bootstrapping org had no admin to authorise it.
--   Classic lockout: the safety catch fired with nobody able to release it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Guard only real user sessions.
--
-- The threat this exists for is a signed-in member setting their own role to
-- 'admin' through PostgREST — that request always carries a JWT, so `auth.uid()`
-- is non-null. A null uid means the service-role key or a direct database
-- connection, both of which already require a secret and are the intended way to
-- manage roles.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'only admins may change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sync the role from auth.users on UPDATE as well as INSERT.
--
-- This is what makes `app_metadata.role` actually authoritative: whenever GoTrue
-- writes it — at creation, or later via updateUserById — the profile follows.
-- app_metadata is not user-writable, so this cannot be used to self-promote.
--
-- `is distinct from` guards against a no-op update rewriting `updated_at` on
-- every token refresh.
-- -----------------------------------------------------------------------------
create or replace function public.sync_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.user_role;
begin
  claimed := (new.raw_app_meta_data ->> 'role')::public.user_role;
  if claimed is null then
    return new;
  end if;

  update public.profiles
     set role = claimed
   where id = new.id
     and role is distinct from claimed;

  return new;
end;
$$;

create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_role();

-- -----------------------------------------------------------------------------
-- Bootstrap: if the org has no admin at all, promote the earliest account.
--
-- Runs once, and only in the state that is otherwise unrecoverable through the
-- app — no admin exists, so nothing in the UI can create one. A no-op on any
-- database that already has an admin.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    update public.profiles
       set role = 'admin'
     where id = (select id from public.profiles order by created_at limit 1);
  end if;
end;
$$;
