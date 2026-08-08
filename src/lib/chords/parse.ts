import { isChordLine, isSectionLine } from './detect';
import { normalizeSheet } from './normalize';

export type ChordColumn = {
  /** Empty for the lyric that precedes the first chord on the line. */
  chord: string;
  text: string;
};

export type SheetLine =
  | { kind: 'blank' }
  | { kind: 'section'; text: string }
  /** A chord line with the lyric line it sits above, split into aligned columns. */
  | { kind: 'pair'; columns: ChordColumn[] }
  /** A chord line with no lyric under it — an intro or instrumental break. */
  | { kind: 'chords'; text: string }
  | { kind: 'lyric'; text: string };

/**
 * Splits a lyric line at the column positions of the chords above it.
 *
 * This is the part that makes mixed Georgian/Latin sheets render correctly.
 * The naive approach — one `<pre>` in a monospace font — relies on every glyph
 * having the same advance width, and no monospace font covers Georgian. The
 * chords would drift further right with every Georgian character.
 *
 * Anchoring each chord to its character offset and letting the browser lay the
 * columns out side by side makes alignment independent of font metrics, so it
 * survives any font, any size, and the reader bumping the text size up.
 */
function pairColumns(chordLine: string, lyricLine: string): ChordColumn[] {
  const chords = [...chordLine.matchAll(/\S+/g)].map((match) => ({
    index: match.index,
    chord: match[0],
  }));

  if (chords.length === 0) return [{ chord: '', text: lyricLine }];

  const columns: ChordColumn[] = [];

  // Lyric that starts before the first chord belongs in its own leading column.
  const firstIndex = chords[0]?.index ?? 0;
  if (firstIndex > 0) {
    columns.push({ chord: '', text: lyricLine.slice(0, firstIndex) });
  }

  chords.forEach(({ index, chord }, i) => {
    const end = chords[i + 1]?.index;
    // A chord past the end of the lyric (common on the last beat of a line)
    // yields an empty segment, which still renders the chord in place.
    columns.push({ chord, text: lyricLine.slice(index, end) });
  });

  return columns;
}

/**
 * Splits one column's lyric at its own word boundaries.
 *
 * Without this a `pair` row can only break where a chord starts, and the most
 * ordinary line in any song — one chord, at column 0 — therefore has no break
 * point at all: the entire lyric is one column, so a phone gets a sideways
 * scrollbar instead of a second line.
 *
 * Each piece carries the spaces around its word, so the text reassembles
 * byte-for-byte and the spacing that positions later chords is untouched. Only
 * the first piece keeps the chord, because the chord names the character at the
 * column's start and that character is in the first piece by definition — which
 * is what makes this safe to do: wrapping gains line breaks without moving a
 * single chord relative to the syllable under it.
 */
function splitAtWords(column: ChordColumn): ChordColumn[] {
  const pieces = column.text.match(/\s*\S+\s*/g);
  if (pieces === null || pieces.length <= 1) return [column];

  return pieces.map((text, index) => ({ chord: index === 0 ? column.chord : '', text }));
}

/**
 * Groups columns into runs that must not be split across a line break.
 *
 * A `pair` renders as a row of columns, and the browser wraps *between* them.
 * But a column boundary is a chord position, not a word boundary — a chord
 * landing mid-word cuts the lyric there, and on a narrow screen the wrap then
 * splits the word in half.
 *
 * A break is only safe where the boundary falls on whitespace: either the column
 * before it ends with a space, or the column after it starts with one. Every
 * other boundary is inside a word, so those columns are grouped and travel
 * together.
 */
export function groupColumns(columns: ChordColumn[]): ChordColumn[][] {
  const groups: ChordColumn[][] = [];
  let group: ChordColumn[] = [];

  columns.flatMap(splitAtWords).forEach((column, index, all) => {
    group.push(column);

    const next = all[index + 1];
    const breakable =
      next === undefined || /\s$/.test(column.text) || /^\s/.test(next.text) || column.text === '';

    if (breakable) {
      groups.push(group);
      group = [];
    }
  });

  if (group.length > 0) groups.push(group);
  return groups;
}

export function parseChordSheet(source: string): SheetLine[] {
  const lines = normalizeSheet(source).split('\n');
  const result: SheetLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      result.push({ kind: 'blank' });
      continue;
    }

    if (isSectionLine(line)) {
      result.push({ kind: 'section', text: line.trim() });
      continue;
    }

    if (isChordLine(line)) {
      const next = lines[i + 1];
      // Pair with the next line only if it is real lyric text. A chord line
      // followed by a blank, a section header, or more chords stands alone.
      if (next !== undefined && next.trim() !== '' && !isChordLine(next) && !isSectionLine(next)) {
        result.push({ kind: 'pair', columns: pairColumns(line, next) });
        i++; // consume the lyric line
        continue;
      }
      result.push({ kind: 'chords', text: line });
      continue;
    }

    result.push({ kind: 'lyric', text: line });
  }

  return result;
}
