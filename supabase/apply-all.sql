-- Worshipo — all migrations, in order.
-- Generated from supabase/migrations/. Run ONCE in the Supabase SQL Editor.
-- Not itself a migration: files directly under supabase/ are ignored by `supabase db push`.
--
-- One deviation from a plain concatenation, marked inline below: `user_role` is
-- created with all three labels in 0001 and migration 0007 is a no-op here.
-- Postgres will not let a transaction *use* an enum label that the same
-- transaction added, and the SQL Editor runs this whole file as one
-- transaction. `supabase db push` runs each migration in its own transaction,
-- so upstream 0007 stays a real `alter type`.


-- =============================================================================
-- SOURCE: supabase/migrations/20260807000001_init.sql
-- =============================================================================
-- =============================================================================
-- Worshipo — 0001 — schema
-- Georgian worship songs & chords.
-- =============================================================================

create extension if not exists "pg_trgm";      -- fuzzy title match (duplicate detection)
create extension if not exists "citext";       -- case-insensitive email

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
-- All three labels up front. See the note at the top of this file.
create type public.user_role as enum ('admin', 'co_admin', 'user');

-- -----------------------------------------------------------------------------
-- profiles
-- 1:1 with auth.users. Holds the role. Never created by the client — only by the
-- on_auth_user_created trigger below, which is fed by the admin API.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      citext      not null unique,
  name       text        not null default '',
  role       public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application user. Role is the authorization source of truth; mirrored into auth.users.raw_app_meta_data for cheap JWT checks.';

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null unique,
  created_at timestamptz not null default now()
);

-- Georgian has no letter case, but names may be Latin ("Kids", "Youth").
create unique index categories_name_lower_key on public.categories (lower(name));

-- -----------------------------------------------------------------------------
-- songs
-- lyrics_with_chords is the canonical inline format (chord line above lyric line).
-- lyrics_plain is the chord-stripped projection, written by the app on save and
-- used for full-text search so chord tokens (G, Em, C#m7) never pollute the index.
-- -----------------------------------------------------------------------------
create table public.songs (
  id                 uuid primary key default gen_random_uuid(),
  title              text        not null check (length(btrim(title)) > 0),
  artist             text,
  language           text        not null default 'ka',
  lyrics_with_chords text        not null default '',
  lyrics_plain       text        not null default '',
  notes              text,
  key                text,
  capo               smallint    check (capo is null or (capo between 0 and 12)),
  created_by         uuid        references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Generated, so it can never drift from the row. 'simple' config: Postgres ships
  -- no Georgian stemmer, and 'simple' does exactly what we need — unicode-aware
  -- lowercasing + token splitting, no stopword removal, no stemming.
  search_vector tsvector generated always as (
      setweight(to_tsvector('simple', coalesce(title, '')),        'A')
   || setweight(to_tsvector('simple', coalesce(artist, '')),       'B')
   || setweight(to_tsvector('simple', coalesce(lyrics_plain, '')), 'C')
  ) stored
);

create index songs_search_vector_idx on public.songs using gin (search_vector);
create index songs_title_trgm_idx    on public.songs using gin (title gin_trgm_ops);
create index songs_created_at_idx    on public.songs (created_at desc);
create index songs_created_by_idx    on public.songs (created_by);

-- -----------------------------------------------------------------------------
-- song_versions
-- One song -> many arrangements. A version overrides lyrics/key/capo; anything
-- null falls back to the parent song at read time.
-- -----------------------------------------------------------------------------
create table public.song_versions (
  id                 uuid primary key default gen_random_uuid(),
  song_id            uuid        not null references public.songs (id) on delete cascade,
  version_name       text        not null check (length(btrim(version_name)) > 0),
  lyrics_with_chords text        not null default '',
  lyrics_plain       text        not null default '',
  notes              text,
  key                text,
  capo               smallint    check (capo is null or (capo between 0 and 12)),
  created_by         uuid        references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (song_id, version_name)
);

create index song_versions_song_id_idx on public.song_versions (song_id, created_at);

-- -----------------------------------------------------------------------------
-- song_categories (join)
-- -----------------------------------------------------------------------------
create table public.song_categories (
  song_id     uuid not null references public.songs (id)      on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (song_id, category_id)
);

-- Reverse lookup: "all songs in category X".
create index song_categories_category_id_idx on public.song_categories (category_id, song_id);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

create trigger song_versions_set_updated_at
  before update on public.song_versions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profile provisioning
-- The admin API (service role) creates the auth user with app_metadata.role and
-- user_metadata.name; this trigger materialises the profile row. There is no
-- client-reachable path that inserts into profiles.
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
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Seed categories
-- -----------------------------------------------------------------------------
insert into public.categories (name, slug) values
  ('თაყვანისცემა', 'worship'),
  ('ბავშვები',     'kids'),
  ('ახალგაზრდები', 'youth'),
  ('შობა',         'christmas'),
  ('აღდგომა',      'easter'),
  ('ზიარება',      'communion'),
  ('ლოცვა',        'prayer'),
  ('ქართული',      'georgian'),
  ('English',      'english')
on conflict do nothing;


-- =============================================================================
-- SOURCE: supabase/migrations/20260807000002_rls.sql
-- =============================================================================
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


-- =============================================================================
-- SOURCE: supabase/migrations/20260807000003_search.sql
-- =============================================================================
-- =============================================================================
-- Worshipo — 0003 — search & duplicate detection
--
-- Both functions are SECURITY INVOKER (the default) on purpose: RLS still
-- applies, so the RPCs cannot become a read side-channel around the policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Turn free user input into a prefix tsquery: "დიდ ღმერ" -> 'დიდ':* & 'ღმერ':*
-- Prefix matching is what makes search feel instant while the user is still
-- typing. Punctuation is stripped so a stray quote cannot throw a syntax error.
-- -----------------------------------------------------------------------------
create or replace function public.build_prefix_tsquery(q text)
returns tsquery
language sql
immutable
as $$
  select case
    when coalesce(btrim(q), '') = '' then null
    else to_tsquery(
      'simple',
      array_to_string(
        array(
          select quote_literal(tok) || ':*'
          from unnest(regexp_split_to_array(btrim(regexp_replace(q, '[^\w\s]', ' ', 'g')), '\s+')) as tok
          where tok <> ''
        ),
        ' & '
      )
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- search_songs
--
-- One round trip for the whole songs screen: free text + category filter +
-- pagination + category names for the result cards.
--
-- Ranking blends two signals, because they fail in different places:
--   ts_rank   — good at "these words appear in the lyrics", useless for typos
--   similarity— trigram title match, catches typos and partial words
-- Weight A/B/C from the generated column means a title hit outranks a lyric hit.
-- -----------------------------------------------------------------------------
create or replace function public.search_songs(
  p_query       text     default null,
  p_category_ids uuid[]  default null,
  p_limit       int      default 30,
  p_offset      int      default 0
)
returns table (
  id         uuid,
  title      text,
  artist     text,
  key        text,
  capo       smallint,
  language   text,
  snippet    text,
  categories jsonb,
  created_at timestamptz,
  rank       real,
  total_count bigint
)
language sql
stable
-- Function-local, so the threshold is versioned with the code instead of living
-- in a session GUC that every client would have to remember to set.
set pg_trgm.similarity_threshold = '0.25'
as $$
  with q as (
    select
      public.build_prefix_tsquery(p_query) as tsq,
      nullif(btrim(coalesce(p_query, '')), '') as raw
  ),
  matched as (
    select
      s.*,
      case
        when q.tsq is null then 0::real
        else ts_rank(s.search_vector, q.tsq) + similarity(s.title, q.raw)
      end as rank
    from public.songs s
    cross join q
    where
      (q.tsq is null or s.search_vector @@ q.tsq or s.title % q.raw)
      and (
        p_category_ids is null
        or cardinality(p_category_ids) = 0
        or exists (
          select 1 from public.song_categories sc
          where sc.song_id = s.id and sc.category_id = any (p_category_ids)
        )
      )
  ),
  counted as (select count(*) as n from matched)
  select
    m.id,
    m.title,
    m.artist,
    m.key,
    m.capo,
    m.language,
    case
      when (select tsq from q) is null then left(m.lyrics_plain, 120)
      else ts_headline('simple', m.lyrics_plain, (select tsq from q),
                       'StartSel=<mark>,StopSel=</mark>,MaxWords=18,MinWords=6,MaxFragments=1')
    end as snippet,
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) order by c.name)
       from public.song_categories sc
       join public.categories c on c.id = sc.category_id
       where sc.song_id = m.id),
      '[]'::jsonb
    ) as categories,
    m.created_at,
    m.rank,
    counted.n as total_count
  from matched m
  cross join counted
  order by m.rank desc, m.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- -----------------------------------------------------------------------------
-- find_similar_songs
--
-- Called from the create-song form as the admin types the title. Deliberately
-- separate from search_songs: it is title-only, typo-tolerant, and returns the
-- version count so the UI can offer "add a version to this song" directly.
-- -----------------------------------------------------------------------------
create or replace function public.find_similar_songs(
  p_title text,
  p_limit int default 5
)
returns table (
  id            uuid,
  title         text,
  artist        text,
  version_count bigint,
  similarity    real
)
language sql
stable
set pg_trgm.similarity_threshold = '0.25'
as $$
  select
    s.id,
    s.title,
    s.artist,
    (select count(*) from public.song_versions v where v.song_id = s.id) as version_count,
    similarity(s.title, btrim(p_title)) as similarity
  from public.songs s
  where length(btrim(coalesce(p_title, ''))) >= 3
    and (
      s.title % btrim(p_title)                                  -- trigram, typo tolerant
      or s.title ilike '%' || btrim(p_title) || '%'              -- substring, catches short prefixes
    )
  order by similarity desc, s.title
  limit greatest(p_limit, 1);
$$;

-- Search is part of the public songbook, so anon gets it too. Safe because both
-- functions are SECURITY INVOKER: they see exactly what the caller's RLS
-- policies allow and nothing more.
--
-- NOTE: these grants alone do not restrict anything — Postgres grants EXECUTE to
-- PUBLIC on every new function, so the revokes in migration 0004 are what makes
-- this list meaningful. Do not delete that migration.
grant execute on function public.search_songs(text, uuid[], int, int) to anon, authenticated;
grant execute on function public.build_prefix_tsquery(text)           to anon, authenticated;

-- Duplicate detection is an authoring aid, not a public feature.
grant execute on function public.find_similar_songs(text, int)        to authenticated;


-- =============================================================================
-- SOURCE: supabase/migrations/20260807000004_function_grants.sql
-- =============================================================================
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
-- SOURCE: supabase/migrations/20260807000005_fix_role_provisioning.sql
-- =============================================================================
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


-- =============================================================================
-- SOURCE: supabase/migrations/20260807000006_song_version_name.sql
-- =============================================================================
-- =============================================================================
-- Worshipo — 0006 — name the song's own arrangement
--
-- A song's first arrangement is the `songs` row itself: there is no
-- `song_versions` row for it, which is what makes a song with zero versions
-- already complete rather than something that has to be bootstrapped with an
-- empty "original". That design stays.
--
-- What it could not do was carry a *name*. The UI hard-coded the string
-- "Original" for it, so the one arrangement every song has was the one
-- arrangement nobody could rename — and it was the only English word left in a
-- Georgian interface whose section markers are ლექსი and მისამღერი.
--
-- The column mirrors `song_versions.version_name` exactly (not null, non-empty)
-- because the two are the same concept: the switcher reads both into one list
-- of arrangements, and a difference in the rules here would show up there as
-- one tab that behaves unlike its neighbours.
--
-- Note it deliberately does NOT participate in `search_vector`. An arrangement
-- name is navigation, not content — indexing it would surface songs for a query
-- like "მთავარი" that match nothing a person was actually looking for.
-- =============================================================================

-- `if not exists` because this is pasted into the SQL Editor by hand, and a
-- migration run twice should be a no-op rather than an error that looks like a
-- real failure.
alter table public.songs
  add column if not exists version_name text not null default 'მთავარი'
    check (length(btrim(version_name)) > 0);

comment on column public.songs.version_name is
  'Name of the song''s own arrangement, shown alongside song_versions.version_name in the switcher.';

-- PostgREST answers from a cached copy of the schema, so a column it has not
-- reloaded does not exist as far as the API is concerned — that is the
-- "Could not find the 'version_name' column of 'songs' in the schema cache"
-- error, thrown against a database where the column is plainly there.
-- Supabase reloads on DDL via an event trigger, but only for changes it sees;
-- asking explicitly costs nothing and removes the guesswork.
notify pgrst, 'reload schema';


-- =============================================================================
-- SOURCE: supabase/migrations/20260808000007_co_admin_enum.sql
-- =============================================================================
-- =============================================================================
-- Worshipo — 0007 — add the 'co_admin' role
--
-- Alone in its own migration on purpose. Postgres allows `alter type ... add
-- value` inside a transaction block, but the new label cannot be *used* until
-- that transaction commits — so a single file that both adds 'co_admin' and
-- writes `role = 'co_admin'` in a function body fails with
-- "unsafe use of new value of enum type". 0008 is where it gets used.
--
-- Role model after this pair of migrations:
--   user      member. Signs in (Google or password), reads the songbook.
--   co_admin  everything an admin can do EXCEPT user management.
--   admin     co_admin + promoting/demoting/deleting accounts.
-- =============================================================================

-- No-op here: 0001 above already created the enum with 'co_admin'.


-- =============================================================================
-- SOURCE: supabase/migrations/20260808000008_co_admin_policies.sql
-- =============================================================================
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
