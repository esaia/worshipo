/**
 * The one place a chord sheet is put into canonical form.
 *
 * Sheets arrive from four directions — typed into the textarea, pasted from a
 * chord site, extracted from a photo by the AI importer, and written back by the
 * chord canvas — and three of those routinely carry trailing spaces. Nothing
 * downstream can tell them apart from deliberate ones, so they survive into the
 * database and then into the layout, where they are not invisible at all: the
 * canvas gives every character its own slot box, so a line that ends in eleven
 * spaces drags eleven empty, hoverable boxes behind it.
 *
 * Trailing whitespace is the only whitespace that is safe to touch here.
 * *Leading* whitespace on a chord line is the entire storage format — it is what
 * says which syllable a chord sits over — so it is left exactly as written.
 */

/** Trailing whitespace on a single line. Not `trimEnd`: that would eat \r too. */
const TRAILING = /[ \t ]+$/;

/**
 * Canonicalises line endings, strips trailing whitespace from every line, and
 * drops blank lines from the end of the sheet.
 *
 * Idempotent, and safe to run on both read and write — which it is, because
 * rows written before this existed still hold the old whitespace and have to
 * render correctly without a migration.
 */
export function normalizeSheet(source: string): string {
  return source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(TRAILING, ''))
    .join('\n')
    .replace(/\n+$/, '');
}
