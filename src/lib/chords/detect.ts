/**
 * Chord recognition.
 *
 * The whole storage format rests on one question: is this line chords, or is it
 * lyrics? Everything else — the plain-text projection used for search, the
 * aligned renderer — is downstream of that answer.
 *
 * This is a heuristic, but it is a near-exact one *for this catalogue*: chords
 * are Latin and Georgian is a different Unicode block, so a Georgian lyric line
 * can never be mistaken for chords. The same code in a Latin-script app would
 * misfire constantly (a lyric line reading "A" or "Add" would vanish).
 */

/**
 * Matches one chord token.
 *
 * Deliberately flat — no nested quantifiers — so it cannot backtrack
 * catastrophically on adversarial input pasted from a PDF.
 *
 *   G  Am  C#m7  Bb  Dsus4  Cmaj7  F#m7  G/B  D/F#  C7sus4  Gadd9
 */
const CHORD =
  /^[A-G][b#]?(?:maj|min|m|M|dim|aug|sus|add|°|ø)?\d{0,2}(?:(?:sus|add|maj|b|#)\d{1,2})?(?:\/[A-G][b#]?)?$/;

/** Tokens that appear on chord lines without being chords. */
const CHORD_LINE_MARKERS = new Set(['|', '||', '/', '%', '-', 'x2', 'x3', 'x4', 'N.C.', 'NC']);

export function isChordToken(token: string): boolean {
  return CHORD.test(token) || CHORD_LINE_MARKERS.has(token);
}

/**
 * A chord line is a non-blank line whose every token is a chord.
 *
 * "Every" rather than "any" matters: `Verse 1` and `გუნდი` both contain tokens
 * that are not chords, so neither is misread as one.
 */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(isChordToken);
}

const SECTION_LATIN =
  /^\s*\[?\s*(?:verse|chorus|bridge|intro|outro|pre-?chorus|tag|refrain|ending)\b/i;

/**
 * Separate pattern for Georgian, without `\b`.
 *
 * JavaScript's `\b` is defined against `[A-Za-z0-9_]`, so there is no word
 * boundary at the end of "გუნდი" — both sides are non-word characters and the
 * Latin pattern silently never matches Georgian.
 */
const SECTION_GEORGIAN =
  /^\s*\[?\s*(?:ლექსი|მისამღერი|გუნდი|ხიდი|დასაწყისი|დასასრული|სოლო|დასკვნა)/;

/** Structure markers: "Chorus", "Verse 2", "[Bridge]", "გუნდი". */
export function isSectionLine(line: string): boolean {
  return SECTION_LATIN.test(line) || SECTION_GEORGIAN.test(line);
}
