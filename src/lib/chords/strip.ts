import { isChordLine } from './detect';

/**
 * Chord-stripped projection of a song, stored as `songs.lyrics_plain`.
 *
 * Why store it rather than compute it in SQL: the search vector is a generated
 * column, so it can only reference stored columns. Deriving this in TypeScript
 * also keeps the heuristic unit-testable and lets it change without a migration
 * that rewrites every row.
 *
 * Why it matters for search: without it, the FTS index would contain `G`, `Em`,
 * `C` and `D` for nearly every song, and a search for a real word would rank
 * against that noise.
 */
export function stripChords(lyricsWithChords: string): string {
  return (
    lyricsWithChords
      .split('\n')
      .filter((line) => !isChordLine(line))
      .join('\n')
      // Removing chord lines leaves double gaps where a section had a chord
      // line above its first lyric; collapse them so the plain text reads well.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
