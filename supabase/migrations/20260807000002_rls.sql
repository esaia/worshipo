-- =============================================================================
-- Worshipo — 0002 — Row Level Security
--
-- Model: public songbook, private admin.
--
--   anon          reads the catalogue (songs, versions, categories) — no account
--   authenticated same, plus its own profile
--   admin         writes everything
--
-- `profiles` is the exception: it is never readable anonymously. Member names
-- and email addresses are not part of the public songbook.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin(): security definer so the policy on profiles does not re-enter RLS
-- on profiles (infinite recursion). STABLE, so Postgres evaluates it once per
-- statement rather than once per row.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant   execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. Nothing is reachable until a policy says so.
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.songs           enable row level security;
alter table public.song_versions   enable row level security;
alter table public.song_categories enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- Readable by signed-in users only — deliberately NOT `anon`. The songbook is
-- public; the list of who runs it is not.
-- Users may rename themselves; only admins may touch anyone else, and role
-- changes are gated by the trigger below, not by the policy.
-- Inserts happen only via the on_auth_user_created trigger (security definer),
-- so there is deliberately no INSERT policy.
-- -----------------------------------------------------------------------------
create policy "profiles: authenticated read"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: self or admin update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles: admin delete"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- Privilege escalation guard. Without this, the self-update policy above would
-- let any user set their own role to 'admin'.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only admins may change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Do not let the org lock itself out.
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'cannot remove the last admin' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

-- -----------------------------------------------------------------------------
-- categories / songs / song_versions / song_categories
--
-- Identical shape: the songbook is world-readable, writes are admin-only.
--
-- `to anon, authenticated` is spelled out rather than using `to public`: the
-- `public` role also covers `service_role` and any future database role, and an
-- explicit list is what makes the intent auditable at a glance.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories', 'songs', 'song_versions', 'song_categories']
  loop
    execute format($f$
      create policy %1$I on public.%2$I for select
        to anon, authenticated using (true);
      create policy %3$I on public.%2$I for insert
        to authenticated with check (public.is_admin());
      create policy %4$I on public.%2$I for update
        to authenticated using (public.is_admin()) with check (public.is_admin());
      create policy %5$I on public.%2$I for delete
        to authenticated using (public.is_admin());
    $f$,
      t || ': public read',
      t,
      t || ': admin insert',
      t || ': admin update',
      t || ': admin delete'
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage: private bucket for song source photos.
--
-- The default AI import path never persists the photo (see docs/ARCHITECTURE.md
-- §7) — this bucket exists for admins who want to keep the original scan
-- attached to a song, and for the deferred-processing variant.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-imports', 'song-imports', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "song-imports: admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'song-imports' and public.is_admin());

create policy "song-imports: admin write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'song-imports' and public.is_admin());

create policy "song-imports: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'song-imports' and public.is_admin());
