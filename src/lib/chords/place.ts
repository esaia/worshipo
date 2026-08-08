import { isChordLine, isSectionLine } from './detect';
import { renderChordLine, tokenizeChordLine, type ChordToken } from './edit';
import { normalizeSheet } from './normalize';

/**
 * Chord placement addressed by row and column instead of by caret offset.
 *
 * `edit.ts` exists to serve a textarea: every operation is phrased as
 * `(value, caret)` because the caret is the only thing a textarea can tell you
 * about intent. A direct-manipulation surface knows far more than that — the
 * user tapped *this* character of *this* line — and squeezing that back through
 * a caret offset would throw the information away and then guess at it again.
 *
 * So these are the same edits expressed against what the canvas actually knows.
 * Both files render chord lines through `renderChordLine`, so a sheet edited by
 * tapping and a sheet edited by typing stay byte-identical in storage.
 */

/** Which chord line an operation acts on: the one above a lyric, or a standalone one. */
export type ChordTarget = { lyricLineIndex: number } | { chordLineIndex: number };

export type SheetRow =
  | { kind: 'blank'; lineIndex: number }
  | { kind: 'section'; lineIndex: number; text: string }
  /** A chord line with no lyric under it — an intro or an instrumental break. */
  | { kind: 'chords'; lineIndex: number; tokens: ChordToken[] }
  | {
      kind: 'lyric';
      lineIndex: number;
      text: string;
      /** Null until the line acquires its first chord. */
      chordLineIndex: number | null;
      tokens: ChordToken[];
    };

/**
 * The sheet as editable rows.
 *
 * Deliberately not `parseChordSheet`: that one splits a lyric into pre-sliced
 * columns for *display*, which is the wrong shape here. The canvas needs every
 * character individually addressable and needs the source line indices to write
 * back to, neither of which survives the column split.
 */
export function readSheet(source: string): SheetRow[] {
  const lines = normalizeSheet(source).split('\n');
  const rows: SheetRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      rows.push({ kind: 'blank', lineIndex: i });
      continue;
    }

    if (isSectionLine(line)) {
      rows.push({ kind: 'section', lineIndex: i, text: line.trim() });
      continue;
    }

    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== '' && !isChordLine(next) && !isSectionLine(next)) {
        rows.push({
          kind: 'lyric',
          lineIndex: i + 1,
          text: next,
          chordLineIndex: i,
          tokens: tokenizeChordLine(line),
        });
        i++; // consume the lyric
        continue;
      }

      rows.push({ kind: 'chords', lineIndex: i, tokens: tokenizeChordLine(line) });
      continue;
    }

    rows.push({ kind: 'lyric', lineIndex: i, text: line, chordLineIndex: null, tokens: [] });
  }

  return rows;
}

/**
 * Finds the chord line for a target, optionally opening one.
 *
 * Returns the (possibly extended) line array rather than mutating, so a caller
 * that decides against the edit leaves no empty line behind.
 */
function resolve(
  lines: string[],
  target: ChordTarget,
  create: boolean,
): { lines: string[]; chordLineIndex: number } | null {
  if ('chordLineIndex' in target) {
    return target.chordLineIndex < lines.length
      ? { lines, chordLineIndex: target.chordLineIndex }
      : null;
  }

  const { lyricLineIndex } = target;
  if (lyricLineIndex < 0 || lyricLineIndex >= lines.length) return null;

  const above = lyricLineIndex > 0 ? (lines[lyricLineIndex - 1] ?? '') : null;
  if (above !== null && above.trim() !== '' && isChordLine(above)) {
    return { lines, chordLineIndex: lyricLineIndex - 1 };
  }

  if (!create) return null;

  const next = [...lines];
  next.splice(lyricLineIndex, 0, '');
  return { lines: next, chordLineIndex: lyricLineIndex };
}

/**
 * Drops tokens that would collide with a chord occupying `[column, column+len)`.
 *
 * Same rule as `insertChord`: placing a chord on top of another means replacing
 * it, because tapping G and then Am at one spot is a correction, not a stack.
 */
function withoutOverlap(tokens: ChordToken[], column: number, length: number): ChordToken[] {
  return tokens.filter(
    (token) => token.index >= column + length || column >= token.index + token.chord.length,
  );
}

function write(lines: string[], chordLineIndex: number, tokens: ChordToken[]): string {
  const next = [...lines];

  if (tokens.length === 0) {
    // An emptied chord line is removed, not left blank: a stray blank between a
    // lyric and the line above it reads as a paragraph break that nobody typed.
    next.splice(chordLineIndex, 1);
    return next.join('\n');
  }

  next[chordLineIndex] = renderChordLine(tokens);
  return next.join('\n');
}

/**
 * Places `chord` at `column`, creating the chord line if the lyric has none.
 *
 * `column` may sit past the end of the lyric — that is the normal way to mark a
 * chord change on the last beat of a line, and it is exactly the case that was
 * unreachable without typing trailing spaces by hand.
 */
export function putChord(
  source: string,
  target: ChordTarget,
  column: number,
  chord: string,
): string {
  const trimmed = chord.trim();
  if (trimmed === '') return source;

  const resolved = resolve(normalizeSheet(source).split('\n'), target, true);
  if (!resolved) return source;

  const { lines, chordLineIndex } = resolved;
  const existing = tokenizeChordLine(lines[chordLineIndex] ?? '');
  const index = Math.max(0, column);

  return write(lines, chordLineIndex, [
    ...withoutOverlap(existing, index, trimmed.length),
    { index, chord: trimmed },
  ]);
}

/** Moves the chord starting at `fromColumn` to `toColumn`. A no-op if none is there. */
export function moveChord(
  source: string,
  target: ChordTarget,
  fromColumn: number,
  toColumn: number,
): string {
  const resolved = resolve(normalizeSheet(source).split('\n'), target, false);
  if (!resolved) return source;

  const { lines, chordLineIndex } = resolved;
  const tokens = tokenizeChordLine(lines[chordLineIndex] ?? '');
  const moving = tokens.find((token) => token.index === fromColumn);
  if (!moving) return source;

  const index = Math.max(0, toColumn);
  if (index === fromColumn) return source;

  const rest = tokens.filter((token) => token !== moving);
  return write(lines, chordLineIndex, [
    ...withoutOverlap(rest, index, moving.chord.length),
    { index, chord: moving.chord },
  ]);
}

/** Removes the chord starting at `column`, and the chord line with it if it was the last. */
export function removeChordAt(source: string, target: ChordTarget, column: number): string {
  const resolved = resolve(normalizeSheet(source).split('\n'), target, false);
  if (!resolved) return source;

  const { lines, chordLineIndex } = resolved;
  const tokens = tokenizeChordLine(lines[chordLineIndex] ?? '');
  if (!tokens.some((token) => token.index === column)) return source;

  return write(
    lines,
    chordLineIndex,
    tokens.filter((token) => token.index !== column),
  );
}
