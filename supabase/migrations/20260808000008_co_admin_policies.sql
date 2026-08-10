-- =============================================================================
-- Worshipo — 0008 — open sign-in, split "can edit" from "can administer"
--
-- Two changes that belong together, because the second is what makes the first
-- safe.
--
-- 1. Anyone may now sign in with Google. New accounts land on `role = 'user'`:
--    a member reads exactly what an anonymous visitor reads. The songbook was
--    already public, so a member gains nothing but a name in the corner — which
--    is the point. Nobody self-promotes: `role` is only ever written by this
--    file's triggers or by an admin.
--
-- 2. Authoring is no longer the same privilege as user management.
--    `is_admin()` keeps its old meaning (promote, demote, delete accounts) and
--    every *content* policy moves to the new `can_edit()`, which admits admins
--    and co-admins alike. Splitting them at the database, not in the app, is
--    what makes "co-admin cannot touch users" true for a hand-rolled PostgREST
--    request and not just for the UI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- can_edit(): may write the songbook. admin or co_admin.
--
-- Same shape as is_admin() and for the same reasons: SECURITY DEFINER so a
-- policy on profiles does not re-enter RLS on profiles, STABLE so it is
-- evaluated once per statement rather than once per row.
-- -----------------------------------------------------------------------------
create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'co_admin')
  );
$$;

comment on function public.can_edit() is
  'True for admin and co_admin. Gate for every songbook write. User management uses is_admin() instead.';

-- The default-privileges revoke in 0004 only applies to functions created by
-- that role afterwards; being explicit costs one line and never goes stale.
revoke execute on function public.can_edit() from public, anon;
grant   execute on function public.can_edit() to authenticated;

-- -----------------------------------------------------------------------------
-- profiles: stop members reading the roster.
--
-- Until now every signed-in account belonged to an admin, so "authenticated may
-- read all profiles" leaked nothing. With open Google sign-in it would hand the
-- name and email of every member to every member. Self plus admin is what the
-- app actually needs: `getSessionProfile()` reads its own row, `/users` reads
-- them all and is admin-only.
--
-- Note co_admin is deliberately NOT here. Co-admins do not manage users, so
-- they have no reason to see the list.
-- -----------------------------------------------------------------------------
drop policy if exists "profiles: authenticated read" on public.profiles;

create policy "profiles: self or admin read"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- The update and delete policies stay on is_admin() unchanged: role changes and
-- account deletion are admin-only, and `profiles_guard_role` (0005) still
-- rejects a user rewriting their own role.

-- -----------------------------------------------------------------------------
-- categories / songs / song_versions / song_categories: is_admin -> can_edit
--
-- Reads are untouched — the songbook is public and stays public. Only the
-- write policies are replaced, and they are dropped by the exact names 0002
-- created so a rerun is a no-op rather than a duplicate.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories', 'songs', 'song_versions', 'song_categories']
  loop
    execute format($f$
      drop policy if exists %1$I on public.%2$I;
      drop policy if exists %3$I on public.%2$I;
      drop policy if exists %4$I on public.%2$I;

      create policy %1$I on public.%2$I for insert
        to authenticated with check (public.can_edit());
      create policy %3$I on public.%2$I for update
        to authenticated using (public.can_edit()) with check (public.can_edit());
      create policy %4$I on public.%2$I for delete
        to authenticated using (public.can_edit());
    $f$,
      t || ': admin insert',
      t,
      t || ': admin update',
      t || ': admin delete'
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage: the song-imports bucket follows authoring, not administration.
-- -----------------------------------------------------------------------------
drop policy if exists "song-imports: admin read"   on storage.objects;
drop policy if exists "song-imports: admin write"  on storage.objects;
drop policy if exists "song-imports: admin delete" on storage.objects;

create policy "song-imports: editor read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'song-imports' and public.can_edit());

create policy "song-imports: editor write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'song-imports' and public.can_edit());

create policy "song-imports: editor delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'song-imports' and public.can_edit());

-- -----------------------------------------------------------------------------
-- Profile provisioning for OAuth sign-ups.
--
-- The admin API path (0001) put the display name in `user_metadata.name`.
-- Google puts it in `full_name`, and also sends `name` — but only sometimes,
-- and `avatar_url`/`picture` vary the same way. Coalescing over the three
-- spellings means one trigger serves both sign-up routes; the email fallback
-- exists because a profile with a blank name renders as the email, which is
-- better than rendering as nothing.
--
-- Role is untouched by this: an OAuth sign-up has no `app_metadata.role`, so
-- every self-service account starts as 'user'. An admin promotes from /users.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      ''
    ),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'user')
  )
  on conflict (id) do nothing;

  return new;

-- profiles.email is unique. Supabase links a Google identity to an existing
-- account when the address matches, so this should not fire — but if it ever
-- does, swallowing it beats aborting the auth.users insert and failing the
-- sign-in with an opaque 500. The account simply has no profile row, which the
-- app reads as signed-out rather than as a privileged state.
exception
  when unique_violation then
    return new;
end;
$$;

notify pgrst, 'reload schema';
