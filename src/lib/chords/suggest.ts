import { isChordToken } from './detect';

/**
 * Which chords to offer on the palette.
 *
 * A guitarist writing a sheet in G reaches for six chords, and they are
 * predictable from the key. Offering those first — rather than a 24-button
 * chromatic grid — is the difference between one tap and a hunt, which matters
 * most on the phone this app is mostly used on.
 */

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Scale degrees and the quality each one takes, for major and natural minor. */
const MAJOR = [
  { step: 0, quality: '' },
  { step: 2, quality: 'm' },
  { step: 4, quality: 'm' },
  { step: 5, quality: '' },
  { step: 7, quality: '' },
  { step: 9, quality: 'm' },
];

const MINOR = [
  { step: 0, quality: 'm' },
  { step: 3, quality: '' },
  { step: 5, quality: 'm' },
  { step: 7, quality: 'm' },
  { step: 8, quality: '' },
  { step: 10, quality: '' },
];

/** Keys conventionally written with flats, plus anything already spelled with one. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm']);

/** Sensible starting set when no key is chosen: the guitar's home chords. */
const FALLBACK = ['G', 'Em', 'C', 'D', 'Am', 'F', 'A', 'E', 'Dm', 'Bm'];

function indexOfRoot(root: string): number {
  const sharp = SHARP.indexOf(root);
  return sharp === -1 ? FLAT.indexOf(root) : sharp;
}

/**
 * The diatonic chords of `key`, tonic first.
 *
 * Minor keys get the major V appended: it is not diatonic, and it is in
 * practically every minor song ever written.
 */
export function suggestChords(key: string): string[] {
  const match = /^([A-G][b#]?)(m?)$/.exec(key.trim());
  if (!match) return FALLBACK;

  const [, root = '', minor] = match;
  const tonic = indexOfRoot(root);
  if (tonic === -1) return FALLBACK;

  const names = FLAT_KEYS.has(key.trim()) || root.includes('b') ? FLAT : SHARP;
  const degrees = minor ? MINOR : MAJOR;

  const chords = degrees.map(({ step, quality }) => `${names[(tonic + step) % 12]}${quality}`);
  if (minor) chords.push(`${names[(tonic + 7) % 12]}`);

  return chords;
}

/** Chords already used in the sheet — so a sheet's own vocabulary stays one tap away. */
export function chordsInUse(source: string): string[] {
  const seen = new Set<string>();

  for (const token of source.split(/\s+/)) {
    if (token !== '' && isChordToken(token) && /^[A-G]/.test(token)) seen.add(token);
  }

  return [...seen];
}

/** The palette: key chords first, then anything else the sheet already uses. */
export function chordPalette(key: string, source: string): string[] {
  const suggested = suggestChords(key);
  const extra = chordsInUse(source).filter((chord) => !suggested.includes(chord));

  return [...suggested, ...extra.sort()];
}
