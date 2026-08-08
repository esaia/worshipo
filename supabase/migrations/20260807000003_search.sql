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
