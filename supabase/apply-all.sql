-- Worshipo — all migrations, in order.
-- Generated from supabase/migrations/. Run ONCE in the Supabase SQL Editor.
-- Not itself a migration: files directly under supabase/ are ignored by `supabase db push`.


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
create type public.user_role as enum ('admin', 'user');

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
grant execute on function public.search_songs(text, uuid[], int, int) to anon, authenticated;
grant execute on function public.build_prefix_tsquery(text)           to anon, authenticated;

-- Duplicate detection is an authoring aid, not a public feature.
grant execute on function public.find_similar_songs(text, int)        to authenticated;

