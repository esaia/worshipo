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
