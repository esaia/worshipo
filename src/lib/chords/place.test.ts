import { describe, expect, it } from 'vitest';

import { moveChord, putChord, readSheet, removeChordAt } from './place';

const SHEET = ['G     Em', 'დიდია ღმერთი', '', 'მისამღერი', 'უფალო ჩემო'].join('\n');

describe('readSheet', () => {
  it('pairs a chord line with the lyric under it and keeps both source indices', () => {
    const rows = readSheet(SHEET);

    expect(rows[0]).toEqual({
      kind: 'lyric',
      lineIndex: 1,
      text: 'დიდია ღმერთი',
      chordLineIndex: 0,
      tokens: [
        { index: 0, chord: 'G' },
        { index: 6, chord: 'Em' },
      ],
    });
  });

  it('reports a lyric with no chords above it as unpaired', () => {
    const rows = readSheet(SHEET);
    expect(rows[3]).toEqual({
      kind: 'lyric',
      lineIndex: 4,
      text: 'უფალო ჩემო',
      chordLineIndex: null,
      tokens: [],
    });
  });

  it('keeps a chord line with no lyric under it standalone', () => {
    const rows = readSheet('G  C  D\n\nლექსი');
    expect(rows[0]).toMatchObject({ kind: 'chords', lineIndex: 0 });
  });
});

describe('putChord', () => {
  it('opens a chord line above a lyric that has none', () => {
    const result = putChord('უფალო ჩემო', { lyricLineIndex: 0 }, 6, 'Am');
    expect(result).toBe('      Am\nუფალო ჩემო');
  });

  it('adds to an existing chord line without disturbing its neighbours', () => {
    const result = putChord(SHEET, { lyricLineIndex: 1 }, 3, 'C');
    expect(result.split('\n')[0]).toBe('G  C  Em');
  });

  it('replaces a chord sitting at the same column rather than stacking', () => {
    const result = putChord(SHEET, { lyricLineIndex: 1 }, 0, 'Am');
    expect(result.split('\n')[0]).toBe('Am    Em');
  });

  /** The case that was unreachable without typing trailing spaces by hand. */
  it('places a chord past the end of the lyric', () => {
    const result = putChord('უფალო', { lyricLineIndex: 0 }, 20, 'D');
    expect(result).toBe(`${' '.repeat(20)}D\nუფალო`);
  });
});

describe('moveChord', () => {
  it('slides a chord to a new column', () => {
    const result = moveChord(SHEET, { lyricLineIndex: 1 }, 6, 9);
    expect(result.split('\n')[0]).toBe('G        Em');
  });

  it('ignores a move from a column with no chord on it', () => {
    expect(moveChord(SHEET, { lyricLineIndex: 1 }, 4, 9)).toBe(SHEET);
  });

  it('displaces a chord it lands on', () => {
    const result = moveChord(SHEET, { lyricLineIndex: 1 }, 6, 0);
    expect(result.split('\n')[0]).toBe('Em');
  });
});

describe('removeChordAt', () => {
  it('removes one chord and leaves the rest in place', () => {
    const result = removeChordAt(SHEET, { lyricLineIndex: 1 }, 0);
    expect(result.split('\n')[0]).toBe('      Em');
  });

  it('drops the whole chord line once the last chord goes', () => {
    const result = removeChordAt('    Am\nუფალო ჩემო', { lyricLineIndex: 1 }, 4);
    expect(result).toBe('უფალო ჩემო');
  });

  it('ignores a column with no chord on it', () => {
    expect(removeChordAt(SHEET, { lyricLineIndex: 1 }, 3)).toBe(SHEET);
  });
});
