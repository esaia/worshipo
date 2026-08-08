import type { Category } from '@/types/domain';

/**
 * Shared vocabulary for search, imported by both the server page and the client
 * island. Deliberately free of `server-only` imports so a client component can
 * use the types without dragging the Supabase server client into the bundle.
 */

export const SEARCH_PAGE_SIZE = 30;

export type SongSearchResult = {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  capo: number | null;
  language: string;
  /** `ts_headline` output: the matched words wrapped in literal <mark> tags. */
  snippet: string;
  categories: Category[];
  created_at: string;
  rank: number;
};

export type SongSearchPage = {
  results: SongSearchResult[];
  /** Total matches, not the length of `results` — drives "showing N of M". */
  total: number;
};

export type SongSearchParams = {
  query: string;
  categoryIds: string[];
  limit: number;
};

/** The URL is the source of truth for search state, so both sides parse it the same way. */
export function parseSearchParams(input: {
  q?: string | string[];
  categories?: string | string[];
}): { query: string; categoryIds: string[] } {
  const q = Array.isArray(input.q) ? input.q[0] : input.q;
  const categories = Array.isArray(input.categories) ? input.categories[0] : input.categories;

  return {
    query: (q ?? '').trim(),
    categoryIds: (categories ?? '').split(',').filter(Boolean),
  };
}

/**
 * `categories` is a JSONB aggregate from the RPC, so it arrives as `Json` and
 * has to be narrowed before it can be rendered.
 */
export function toCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is Category =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Category).id === 'string' &&
      typeof (item as Category).name === 'string',
  );
}

// `[\s\S]` rather than `.` with the `s` flag: the project targets ES2017, where
// the dotAll flag is a compile error. A headline can span a line break.
const MARK = /<mark>([\s\S]*?)<\/mark>/g;

export type SnippetSegment = { text: string; match: boolean };

/**
 * Splits a `ts_headline` result into plain segments and matched segments.
 *
 * Not `dangerouslySetInnerHTML`: `ts_headline` inserts its own `<mark>` tags but
 * does **not** escape the source text around them, so a song whose lyrics happen
 * to contain markup would have it injected into the page verbatim. Splitting on
 * the markers and letting React escape each segment renders the highlight
 * without ever treating stored content as HTML.
 */
export function parseSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let cursor = 0;

  for (const match of snippet.matchAll(MARK)) {
    const start = match.index;
    if (start > cursor) segments.push({ text: snippet.slice(cursor, start), match: false });
    segments.push({ text: match[1] ?? '', match: true });
    cursor = start + match[0].length;
  }

  if (cursor < snippet.length) segments.push({ text: snippet.slice(cursor), match: false });

  return segments.filter((segment) => segment.text !== '');
}
