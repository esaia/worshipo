/**
 * Every chord the pickers offer, in the order a worship guitarist reaches for
 * them rather than alphabetically — triads first, then sevenths, then the colour
 * chords, so the common half is reachable without scrolling or filtering.
 *
 * Shared by the `/` menu and the chord picker sheet. Two copies would drift, and
 * the drift would show up as a chord you can find in one place and not the other.
 */

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Flat spellings, so a sheet written in Eb can be typed as written. */
const FLATS: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

const QUALITIES = [
  '',
  'm',
  '7',
  'm7',
  'maj7',
  'sus2',
  'sus4',
  'add9',
  '9',
  '6',
  'm6',
  'dim',
  'aug',
];

function build(): string[] {
  const chords: string[] = [];

  for (const root of ROOTS) {
    for (const spelling of FLATS[root] ? [root, FLATS[root]] : [root]) {
      for (const quality of QUALITIES) chords.push(`${spelling}${quality}`);
    }
  }

  return chords;
}

export const CHORD_CATALOG = build();
