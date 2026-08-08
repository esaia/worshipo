import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';
import type { Category } from '@/types/domain';
import { toCategories, type SongSearchPage, type SongSearchParams } from './search';

export type SongListItem = Pick<
  Tables<'songs'>,
  'id' | 'title' | 'artist' | 'key' | 'capo' | 'language' | 'created_at'
> & { categories: Category[] };

export type SongVersion = Pick<
  Tables<'song_versions'>,
  'id' | 'version_name' | 'lyrics_with_chords' | 'notes' | 'key' | 'capo'
>;

export type SongDetail = Tables<'songs'> & {
  categories: Category[];
  versions: SongVersion[];
};

/**
 * Supabase returns embedded rows as nested arrays. Flattening here keeps the
 * shape awkwardness in one place instead of in every component that renders a
 * category chip.
 */
type EmbeddedCategories = { categories: Category | null }[] | null;

function flattenCategories(rows: EmbeddedCategories): Category[] {
  return (rows ?? [])
    .map((row) => row.categories)
    .filter((category): category is Category => category !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'ka'));
}

/**
 * The songbook list. One round trip including categories — the alternative,
 * fetching songs then categories per song, is the classic N+1 that makes a
 * list feel slow on mobile data.
 *
 * Ordered newest first. Relevance ordering arrives with search in Phase 3.
 */
export async function listSongs(): Promise<SongListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('songs')
    .select(
      'id, title, artist, key, capo, language, created_at, song_categories(categories(id, name, slug))',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`Could not load songs: ${error.message}`);

  return data.map(({ song_categories, ...song }) => ({
    ...song,
    categories: flattenCategories(song_categories as EmbeddedCategories),
  }));
}

/**
 * Search, server side — the first paint of `/songs`.
 *
 * The client island re-runs the same RPC with the same arguments once the user
 * types, seeded with this result as `initialData`. One SQL function serving both
 * means the server-rendered page and the interactive one can never disagree
 * about ranking.
 */
export async function searchSongs({
  query,
  categoryIds,
  limit,
}: SongSearchParams): Promise<SongSearchPage> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('search_songs', {
    p_query: query === '' ? null : query,
    p_category_ids: categoryIds.length > 0 ? categoryIds : null,
    p_limit: limit,
    p_offset: 0,
  });

  if (error) throw new Error(`Could not search songs: ${error.message}`);

  const rows = data ?? [];

  return {
    results: rows.map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      key: row.key,
      capo: row.capo,
      language: row.language,
      snippet: row.snippet,
      categories: toCategories(row.categories),
      created_at: row.created_at,
      rank: row.rank,
    })),
    // Every row carries the same window-function total; with no rows there is
    // nothing to read it off, and the answer is zero anyway.
    total: Number(rows[0]?.total_count ?? 0),
  };
}

/** Returns null for a missing id so the page can render notFound() rather than throw. */
export async function getSongDetail(id: string): Promise<SongDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('songs')
    .select(
      '*, song_categories(categories(id, name, slug)), song_versions(id, version_name, lyrics_with_chords, notes, key, capo)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Could not load song: ${error.message}`);
  if (!data) return null;

  const { song_categories, song_versions, ...song } = data;

  return {
    ...song,
    categories: flattenCategories(song_categories as EmbeddedCategories),
    versions: (song_versions as SongVersion[] | null) ?? [],
  };
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('categories').select('id, name, slug').order('name');

  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return data;
}

export type CategoryWithCount = Category & { songCount: number };

/** Category list for the admin screen, with usage counts so deletion is informed. */
export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, song_categories(count)')
    .order('name');

  if (error) throw new Error(`Could not load categories: ${error.message}`);

  return data.map(({ song_categories, ...category }) => ({
    ...category,
    songCount: (song_categories as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}
