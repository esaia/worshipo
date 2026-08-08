/**
 * The `/` command trigger, as a pure function over the textarea's value.
 *
 * Kept out of the component for the usual reason: this is the part that is easy
 * to get subtly wrong — a slash inside a lyric, a slash chord like `D/F#`, a
 * caret that has moved away from the slash it opened — and none of those need a
 * DOM to test.
 */

export type SlashQuery = {
  /** Index of the `/` itself, so the caller can replace from there. */
  start: number;
  /** What has been typed after it, lowercased. Empty right after the slash. */
  query: string;
};

/**
 * Reads an open slash command at the caret, or null when there is not one.
 *
 * The slash must **start a word**: preceded by the start of its line or by
 * whitespace, and followed by no whitespace up to the caret.
 *
 * That rule is what makes `D/F#` safe. A slash chord's slash follows a letter,
 * so it never opens the menu, and neither does a slash inside a lyric word.
 * Requiring the line to *begin* with the slash would also have worked, and was
 * the first version — but chords are placed mid-line, so the menu has to be
 * reachable from the middle of a chord line.
 */
export function readSlashQuery(value: string, caret: number): SlashQuery | null {
  if (caret < 0 || caret > value.length) return null;

  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  const before = value.slice(lineStart, caret);

  const match = /(?:^|\s)\/(\S*)$/.exec(before);
  if (!match) return null;

  const query = match[1] ?? '';
  // `match.index` points at the whitespace when there is one, so the slash is
  // the last character of the matched prefix before the query.
  const start = lineStart + match.index + match[0].length - query.length - 1;

  return { start, query: query.toLowerCase() };
}

export type SlashItem = {
  /** Sections are inserted as text; chords go through the chord-line machinery. */
  kind: 'section' | 'chord';
  /** Inserted verbatim, and shown as the row's title. */
  label: string;
  /** Extra words the row matches on, so a Latin keyboard can find a Georgian label. */
  keywords: string[];
  /** Greyed text at the end of the row. */
  hint: string;
};

/** Ranks items against a query. An empty query keeps the authored order. */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  if (query === '') return items;

  return items.filter((item) =>
    [item.label, ...item.keywords].some((term) => term.toLowerCase().includes(query)),
  );
}
