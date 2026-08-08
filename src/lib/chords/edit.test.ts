import { describe, expect, it } from 'vitest';

import {
  insertChord,
  insertSection,
  nudgeChord,
  outdent,
  removeChord,
  undoAutoPeriod,
} from './edit';
import { chordPalette, suggestChords } from './suggest';

/** Marks the caret with `|` so the cases read like what a user actually did. */
function at(text: string): { value: string; caret: number } {
  const caret = text.indexOf('|');
  return { value: text.replace('|', ''), caret };
}

describe('insertChord', () => {
  it('opens a chord line above the lyric and pads to the caret column', () => {
    const { value, caret } = at('დიდია |ღმერთი');
    expect(insertChord(value, caret, 'G').value).toBe('      G\nდიდია ღმერთი');
  });

  it('leaves the caret in the lyric so the next chord can be tapped straight away', () => {
    const { value, caret } = at('დიდია |ღმერთი');
    const first = insertChord(value, caret, 'G');
    const second = insertChord(first.value, first.selection, 'Em');

    expect(second.value).toBe('      Em\nდიდია ღმერთი');
    expect(first.value.slice(first.selection)).toBe('ღმერთი');
  });

  it('adds to the chord line that is already there', () => {
    const { value, caret } = at('G\nდიდია |ღმერთი');
    expect(insertChord(value, caret, 'Em').value).toBe('G     Em\nდიდია ღმერთი');
  });

  it('replaces a chord occupying the same columns rather than stacking one beside it', () => {
    const { value, caret } = at('G\n|დიდია ღმერთი');
    expect(insertChord(value, caret, 'Am').value).toBe('Am\nდიდია ღმერთი');
  });

  it('pushes a neighbour right instead of gluing two chords together', () => {
    const { value, caret } = at('G  Em\nab|cd ef');
    expect(insertChord(value, caret, 'C').value).toBe('G C Em\nabcd ef');
  });

  it('turns a blank line into a chord line, keeping the caret on it', () => {
    const result = insertChord('Verse\n\nლექსი', 6, 'D');
    expect(result.value).toBe('Verse\nD\nლექსი');
    expect(result.selection).toBe(7);
  });

  it('writes into the caret column of a chord line the caret is already on', () => {
    const { value, caret } = at('G   |\nდიდია');
    expect(insertChord(value, caret, 'C').value).toBe('G   C\nდიდია');
  });

  it('ignores an empty chord', () => {
    expect(insertChord('abc', 1, '   ')).toEqual({ value: 'abc', selection: 1 });
  });
});

describe('nudgeChord', () => {
  it('moves the chord above the caret one column at a time', () => {
    const { value, caret } = at('   G\nდიდი|ა');
    const right = nudgeChord(value, caret, 1);
    expect(right.value).toBe('    G\nდიდია');
    expect(nudgeChord(right.value, right.selection, -1).value).toBe('   G\nდიდია');
  });

  it('picks the chord at or before the caret, not the whole line', () => {
    const { value, caret } = at('G    Em\nabcd |efgh');
    expect(nudgeChord(value, caret, 1).value).toBe('G     Em\nabcd efgh');
  });

  it('stops at column zero', () => {
    const { value, caret } = at('G\n|abc');
    expect(nudgeChord(value, caret, -1).value).toBe('G\nabc');
  });

  it('will not push a chord into the one before it', () => {
    const { value, caret } = at('G Em\nab|cd');
    expect(nudgeChord(value, caret, -1).value).toBe('G Em\nabcd');
  });

  it('does nothing when there is no chord line to nudge', () => {
    const { value, caret } = at('დიდია |ღმერთი');
    expect(nudgeChord(value, caret, 1).value).toBe('დიდია ღმერთი');
  });
});

describe('removeChord', () => {
  it('removes the chord at the caret and keeps the rest of the line', () => {
    const { value, caret } = at('G    Em\nabcd |efgh');
    expect(removeChord(value, caret).value).toBe('G\nabcd efgh');
  });

  it('drops the whole line once its last chord is gone', () => {
    const { value, caret } = at('G\nდიდ|ია');
    const result = removeChord(value, caret);
    expect(result.value).toBe('დიდია');
    expect(result.selection).toBe(3);
  });
});

describe('insertSection', () => {
  it('adds a blank line above the header when there is content before it', () => {
    const { value, caret } = at('დიდია ღმერთი\n|მარადიულია');
    expect(insertSection(value, caret, 'გუნდი').value).toBe('დიდია ღმერთი\n\nგუნდი\nმარადიულია');
  });

  it('does not open the sheet with a blank line', () => {
    const { value, caret } = at('|დიდია ღმერთი');
    expect(insertSection(value, caret, 'ლექსი').value).toBe('ლექსი\nდიდია ღმერთი');
  });
});

describe('outdent', () => {
  it('removes up to two trailing spaces before the caret', () => {
    const { value, caret } = at('    |G');
    expect(outdent(value, caret, 2)).toEqual({ value: '  G', selection: 2 });
  });

  it('leaves a line alone when the caret is not after a space', () => {
    expect(outdent('  G|', 3, 2)).toEqual({ value: '  G|', selection: 3 });
  });
});

describe('undoAutoPeriod', () => {
  /** What the OS does: the space before the caret becomes ". " when a second space is typed. */
  function typeSecondSpace(previous: string, caret: number) {
    const substituted = `${previous.slice(0, caret - 1)}. ${previous.slice(caret)}`;
    return undoAutoPeriod(previous, substituted, caret + 1);
  }

  it('restores the two spaces macOS turned into a period', () => {
    expect(typeSecondSpace('Dm ', 3)).toBe('Dm  ');
  });

  it('works mid-line, leaving the rest of the chord line alone', () => {
    expect(typeSecondSpace('Dm    Em', 3)).toBe('Dm     Em');
  });

  it('leaves a period the user typed themselves', () => {
    // "N.C." then a space: the replaced character is a period, not a space.
    expect(undoAutoPeriod('N.C.', 'N.C. ', 5)).toBeNull();
  });

  it('leaves ordinary typing alone', () => {
    expect(undoAutoPeriod('Dm ', 'Dm  ', 4)).toBeNull();
    expect(undoAutoPeriod('დიდია', 'დიდია ', 6)).toBeNull();
  });

  it('ignores edits that merely happen to end in a period and a space', () => {
    // A paste, not a keystroke: more than one character arrived.
    expect(undoAutoPeriod('ab', 'a. b', 3)).toBeNull();
    expect(undoAutoPeriod('', '. ', 2)).toBeNull();
    // The tail changed too, so this was not a two-character substitution.
    expect(undoAutoPeriod('Dm x', 'Dm. y', 4)).toBeNull();
  });
});

describe('suggestChords', () => {
  it('offers the diatonic chords of a major key, tonic first', () => {
    expect(suggestChords('G')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em']);
  });

  it('spells flat keys with flats', () => {
    expect(suggestChords('F')).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm']);
  });

  it('adds the major V to a minor key, because every minor song uses it', () => {
    expect(suggestChords('Em')).toEqual(['Em', 'G', 'Am', 'Bm', 'C', 'D', 'B']);
  });

  it('falls back to the common set when no key is chosen', () => {
    expect(suggestChords('')).toContain('G');
    expect(suggestChords('nonsense')).toContain('Em');
  });
});

describe('chordPalette', () => {
  it('appends chords the sheet already uses, without repeating the key chords', () => {
    const palette = chordPalette('G', 'G  Cmaj7\nდიდია ღმერთი\nEm');
    expect(palette).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'Cmaj7']);
  });

  it('does not mistake Georgian lyrics for chords', () => {
    expect(chordPalette('G', 'დიდია ღმერთი')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em']);
  });
});
