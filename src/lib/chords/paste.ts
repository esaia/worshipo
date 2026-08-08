/**
 * Cleaning up sheets pasted from somewhere else.
 *
 * Most chord-sheet sites and documents render double-spaced — a blank line
 * between every line of text — because it reads better on a web page. Pasted in
 * here that spacing is not cosmetic, it is wrong: a chord line is bound to its
 * lyric by being immediately above it, so a blank between them unpairs every
 * chord in the song. The sheet then renders as bare chord rows floating over
 * nothing, which is exactly what it looks like.
 */

/**
 * Is this text uniformly double-spaced?
 *
 * The test is that *no* two lines of text are adjacent. That is a strong signal
 * and a deliberately conservative one: a single stray blank line somewhere in an
 * otherwise normal sheet fails it, and the text is left alone. Guessing wrong in
 * that direction costs the user one blank line; guessing wrong the other way
 * silently welds two stanzas together.
 */
function isDoubleSpaced(lines: string[]): boolean {
  let blanks = 0;
  let adjacent = false;

  for (let i = 0; i < lines.length - 1; i++) {
    const current = (lines[i] ?? '').trim() === '';
    const next = (lines[i + 1] ?? '').trim() === '';

    if (current) blanks++;
    if (!current && !next) adjacent = true;
  }

  // Two blanks is the floor for calling it a pattern rather than a coincidence.
  return !adjacent && blanks >= 2;
}

/**
 * Removes one blank line from every run of them.
 *
 * Run-based rather than "delete every blank": a real paragraph break in a
 * double-spaced document is *two* blank lines, and it has to survive as one.
 */
function collapseRuns(lines: string[]): string[] {
  const result: string[] = [];
  let run = 0;

  const flush = () => {
    for (let i = 0; i < Math.max(0, run - 1); i++) result.push('');
    run = 0;
  };

  for (const line of lines) {
    if (line.trim() === '') {
      run++;
      continue;
    }
    flush();
    result.push(line);
  }

  flush();
  return result;
}

/**
 * Normalises a pasted chord sheet.
 *
 * Returns the text unchanged when there is nothing to fix, so the caller can
 * fall through to the browser's own paste and keep native undo intact.
 */
export function normalizePastedSheet(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  if (!isDoubleSpaced(lines)) return normalized;

  return collapseRuns(lines).join('\n');
}
