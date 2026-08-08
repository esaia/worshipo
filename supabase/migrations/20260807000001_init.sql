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
