import { isChordLine } from './detect';

/**
 * The text surgery behind "tap a chord, it lands above the cursor".
 *
 * Everything here is pure: `(value, caret) -> { value, selection }`. The editor
 * component owns the textarea and the focus dance; this file owns the only part
 * that is easy to get subtly wrong, so it can be unit tested without a DOM.
 *
 * The storage format is unchanged — chord lines above lyric lines, columns set
 * by spaces. These helpers just stop a human from having to count the spaces.
 */

export type ChordToken = { index: number; chord: string };

export type EditResult = {
  value: string;
  /** Where the caret should sit afterwards. */
  selection: number;
};

export function tokenizeChordLine(line: string): ChordToken[] {
  return [...line.matchAll(/\S+/g)].map((match) => ({ index: match.index, chord: match[0] }));
}

/**
 * Lays tokens back out as a padded line.
 *
 * A token never renders before its requested column, and never closer than one
 * space to the token before it — so inserting into a crowded line pushes its
 * neighbours right instead of gluing two chords into `GEm`.
 */
function place(
  tokens: ChordToken[],
  marked?: ChordToken,
): { line: string; markedAt: number | null } {
  let line = '';
  let markedAt: number | null = null;

  for (const token of [...tokens].sort((a, b) => a.index - b.index)) {
    const earliest = line.length === 0 ? 0 : line.length + 1;
    const start = Math.max(token.index, earliest);
    line = line.padEnd(start, ' ') + token.chord;
    if (token === marked) markedAt = start;
  }

  return { line, markedAt };
}

export function renderChordLine(tokens: ChordToken[]): string {
  return place(tokens).line;
}

type Position = { lines: string[]; lineIndex: number; column: number };

function locate(value: string, caret: number): Position {
  const lines = value.split('\n');
  let remaining = Math.min(Math.max(caret, 0), value.length);
  let lineIndex = 0;

  while (lineIndex < lines.length - 1 && remaining > (lines[lineIndex]?.length ?? 0)) {
    remaining -= (lines[lineIndex]?.length ?? 0) + 1;
    lineIndex++;
  }

  return { lines, lineIndex, column: remaining };
}

function offsetOf(lines: string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) offset += (lines[i]?.length ?? 0) + 1;
  return offset;
}

type Target = {
  lines: string[];
  /** Index of the line the chord lives on. */
  chordLineIndex: number;
  /** Index of the lyric the caret should return to, or null to follow the chord. */
  lyricLineIndex: number | null;
  column: number;
};

/**
 * Works out which line a chord tapped at `caret` belongs on.
 *
 * The four cases, in the order a person would reason about them:
 *   1. caret on a blank line   -> that line becomes the chord line
 *   2. caret on a chord line   -> edit it in place
 *   3. chord line sits above   -> edit that one, caret stays in the lyric
 *   4. otherwise               -> open a fresh chord line above the lyric
 *
 * With `create: false` (nudging, deleting) case 4 has no answer and returns null
 * rather than inventing an empty line.
 */
function resolveTarget(value: string, caret: number, create: boolean): Target | null {
  const { lines, lineIndex, column } = locate(value, caret);
  const current = lines[lineIndex] ?? '';
  const previous = lineIndex > 0 ? (lines[lineIndex - 1] ?? '') : null;

  if (current.trim() === '') {
    return { lines, chordLineIndex: lineIndex, lyricLineIndex: null, column };
  }

  if (isChordLine(current)) {
    return { lines, chordLineIndex: lineIndex, lyricLineIndex: null, column };
  }

  if (previous !== null && isChordLine(previous)) {
    return { lines, chordLineIndex: lineIndex - 1, lyricLineIndex: lineIndex, column };
  }

  if (!create) return null;

  const next = [...lines];
  next.splice(lineIndex, 0, '');
  return { lines: next, chordLineIndex: lineIndex, lyricLineIndex: lineIndex + 1, column };
}

function commit(target: Target, chordLine: string, caretColumn: number): EditResult {
  const lines = [...target.lines];
  lines[target.chordLineIndex] = chordLine;

  const anchor = target.lyricLineIndex ?? target.chordLineIndex;
  const value = lines.join('\n');
  const selection = offsetOf(lines, anchor) + Math.min(caretColumn, lines[anchor]?.length ?? 0);

  return { value, selection };
}

/** The chord the user means when they tap nudge or delete: the last one at or before the caret. */
function tokenAt(tokens: ChordToken[], column: number): ChordToken | null {
  let found: ChordToken | null = null;
  for (const token of tokens) {
    if (token.index <= column) found = token;
  }
  return found ?? tokens[0] ?? null;
}

/**
 * Places `chord` at the caret's column on the chord line that governs it.
 *
 * A chord already occupying those columns is replaced rather than shoved aside —
 * tapping G then Am at the same spot means "no, Am", not "both".
 */
export function insertChord(value: string, caret: number, chord: string): EditResult {
  const trimmed = chord.trim();
  if (trimmed === '') return { value, selection: caret };

  const target = resolveTarget(value, caret, true);
  if (!target) return { value, selection: caret };

  const { column } = target;
  const existing = tokenizeChordLine(target.lines[target.chordLineIndex] ?? '');
  const kept = existing.filter(
    (token) => token.index >= column + trimmed.length || column >= token.index + token.chord.length,
  );

  const inserted: ChordToken = { index: column, chord: trimmed };
  const { line, markedAt } = place([...kept, inserted], inserted);

  // Following the chord only makes sense when the caret is already on the chord
  // line; when it is in the lyric, holding the column lets the next tap land on
  // the next syllable without re-aiming.
  const caretColumn =
    target.lyricLineIndex === null ? (markedAt ?? column) + trimmed.length : column;

  return commit(target, line, caretColumn);
}

/** Shifts the chord at the caret one column left or right. */
export function nudgeChord(value: string, caret: number, direction: -1 | 1): EditResult {
  const target = resolveTarget(value, caret, false);
  if (!target) return { value, selection: caret };

  const tokens = tokenizeChordLine(target.lines[target.chordLineIndex] ?? '');
  const token = tokenAt(tokens, target.column);
  if (!token) return { value, selection: caret };

  const order = [...tokens].sort((a, b) => a.index - b.index);
  const position = order.indexOf(token);
  const previous = position > 0 ? order[position - 1] : undefined;

  // Rightward moves need no floor — `place` pushes the followers along. Leftward
  // ones do, or the token would collide and be bounced straight back.
  const floor = previous ? previous.index + previous.chord.length + 1 : 0;
  const index = Math.max(floor, token.index + direction);
  if (index === token.index) return { value, selection: caret };

  const moved: ChordToken = { index, chord: token.chord };
  const line = renderChordLine([...tokens.filter((item) => item !== token), moved]);

  const caretColumn = target.lyricLineIndex === null ? index : target.column;
  return commit(target, line, caretColumn);
}

/**
 * Removes the chord at the caret, and the whole line with it once it is empty —
 * a stranded blank line between a lyric and the one above it reads as a gap.
 */
export function removeChord(value: string, caret: number): EditResult {
  const target = resolveTarget(value, caret, false);
  if (!target) return { value, selection: caret };

  const tokens = tokenizeChordLine(target.lines[target.chordLineIndex] ?? '');
  const token = tokenAt(tokens, target.column);
  if (!token) return { value, selection: caret };

  const remaining = tokens.filter((item) => item !== token);
  if (remaining.length > 0) {
    const caretColumn = target.lyricLineIndex === null ? token.index : target.column;
    return commit(target, renderChordLine(remaining), caretColumn);
  }

  const lines = [...target.lines];
  lines.splice(target.chordLineIndex, 1);

  const anchor =
    target.lyricLineIndex === null
      ? Math.min(target.chordLineIndex, Math.max(lines.length - 1, 0))
      : target.lyricLineIndex - 1;

  const nextValue = lines.join('\n');
  const selection = offsetOf(lines, anchor) + Math.min(target.column, lines[anchor]?.length ?? 0);
  return { value: nextValue, selection };
}

/** Inserts a section header on its own line above the caret's line. */
export function insertSection(value: string, caret: number, label: string): EditResult {
  const { lines, lineIndex } = locate(value, caret);
  const previous = lineIndex > 0 ? (lines[lineIndex - 1] ?? '') : null;

  // Sections breathe: keep a blank line above unless there already is one, or
  // we are at the very top of the sheet.
  const block = previous !== null && previous.trim() !== '' ? ['', label] : [label];

  const next = [...lines];
  next.splice(lineIndex, 0, ...block);

  const headerIndex = lineIndex + block.length - 1;
  return { value: next.join('\n'), selection: offsetOf(next, headerIndex) + label.length };
}

/** Inserts `text` at the caret, replacing the selection. Used for the Tab key. */
export function insertText(value: string, start: number, end: number, text: string): EditResult {
  return { value: value.slice(0, start) + text + value.slice(end), selection: start + text.length };
}

/**
 * Undoes the "double space inserts a period" substitution, returning the fixed
 * value or null when the change was something the user actually meant.
 *
 * macOS and iOS turn a space typed after a space into `. `. It is a system-level
 * text substitution: `autocorrect="off"` and `spellcheck="false"` do not switch
 * it off, and there is no attribute that does. Everywhere else it is a
 * convenience; here it silently corrupts a chord line, because the gap between
 * two chords *is* the alignment. Typing `Dm` then two spaces produced `Dm. `.
 *
 * So it is caught after the fact, by shape rather than by input event — the two
 * platforms report the substitution differently, but the resulting text is the
 * same. A genuinely typed `.` followed by a space is left alone: the character
 * being replaced was a period, not a space.
 */
export function undoAutoPeriod(previous: string, next: string, caret: number): string | null {
  if (caret < 2 || next.length !== previous.length + 1) return null;
  if (next.slice(caret - 2, caret) !== '. ' || previous[caret - 2] !== ' ') return null;

  // Everything outside the two substituted characters must be untouched,
  // or this is some other edit that happens to end in ". ".
  if (next.slice(0, caret - 2) !== previous.slice(0, caret - 2)) return null;
  if (next.slice(caret) !== previous.slice(caret - 1)) return null;

  return `${next.slice(0, caret - 2)}  ${next.slice(caret)}`;
}

/** Deletes up to `count` spaces immediately before the caret (Shift+Tab). */
export function outdent(value: string, caret: number, count: number): EditResult {
  const before = value.slice(0, caret);
  const removable = before.length - before.replace(/ {1,2}$/, '').length;
  if (removable === 0) return { value, selection: caret };

  const removed = Math.min(removable, count);
  return { value: before.slice(0, -removed) + value.slice(caret), selection: caret - removed };
}
