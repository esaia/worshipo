import { describe, expect, it } from 'vitest';

import { isChordLine, isSectionLine } from './detect';
import { groupColumns, parseChordSheet } from './parse';
import { stripChords } from './strip';

describe('isChordLine', () => {
  it('accepts plain and extended chords', () => {
    expect(isChordLine('G')).toBe(true);
    expect(isChordLine('G  Em  C  D')).toBe(true);
    expect(isChordLine('Am7   C#m7   Bbmaj7')).toBe(true);
    expect(isChordLine('D/F#  G/B')).toBe(true);
    expect(isChordLine('Csus4 Gadd9 Ddim')).toBe(true);
  });

  it('accepts bar and repeat markers alongside chords', () => {
    expect(isChordLine('| G | Em | C | D |')).toBe(true);
    expect(isChordLine('G  x2')).toBe(true);
    expect(isChordLine('N.C.')).toBe(true);
  });

  it('rejects Georgian lyrics — the case this heuristic exists for', () => {
    expect(isChordLine('დიდია ღმერთი')).toBe(false);
    expect(isChordLine('მარადიულია')).toBe(false);
  });

  it('rejects mixed lines and section headers', () => {
    expect(isChordLine('G დიდია')).toBe(false);
    expect(isChordLine('Verse 1')).toBe(false);
    expect(isChordLine('')).toBe(false);
    expect(isChordLine('   ')).toBe(false);
  });
});

describe('isSectionLine', () => {
  it('matches English and Georgian markers, bracketed or bare', () => {
    expect(isSectionLine('Chorus')).toBe(true);
    expect(isSectionLine('Verse 2')).toBe(true);
    expect(isSectionLine('[Bridge]')).toBe(true);
    expect(isSectionLine('გუნდი')).toBe(true);
    expect(isSectionLine('დიდია ღმერთი')).toBe(false);
  });
});

const SONG = `        G
დიდია ღმერთი

       Em
მარადიულია`;

describe('stripChords', () => {
  it('removes chord lines and collapses the gaps they leave', () => {
    expect(stripChords(SONG)).toBe('დიდია ღმერთი\n\nმარადიულია');
  });

  it('leaves a song with no chords untouched', () => {
    expect(stripChords('დიდია ღმერთი\nმარადიულია')).toBe('დიდია ღმერთი\nმარადიულია');
  });

  it('keeps section headers, which are not chords', () => {
    expect(stripChords('Chorus\n   G\nდიდი')).toBe('Chorus\nდიდი');
  });
});

describe('parseChordSheet', () => {
  it('pairs a chord line with the lyric line beneath it, splitting at chord columns', () => {
    //                                012345678
    const [first] = parseChordSheet('  G   C\nდიდია ღმერთი');
    expect(first).toEqual({
      kind: 'pair',
      columns: [
        // G sits at column 2, C at column 6.
        { chord: '', text: 'დი' },
        { chord: 'G', text: 'დია ' },
        { chord: 'C', text: 'ღმერთი' },
      ],
    });
  });

  it('leaves a chord line unpaired when no lyric follows', () => {
    expect(parseChordSheet('G  Em\n\nდიდი')).toEqual([
      { kind: 'chords', text: 'G  Em' },
      { kind: 'blank' },
      { kind: 'lyric', text: 'დიდი' },
    ]);
  });

  it('does not swallow a section header as a lyric line', () => {
    expect(parseChordSheet('G\nChorus')).toEqual([
      { kind: 'chords', text: 'G' },
      { kind: 'section', text: 'Chorus' },
    ]);
  });

  it('handles a chord positioned past the end of the lyric', () => {
    const [first] = parseChordSheet('დიდი     D\nდიდი');
    // The first line is not a chord line (it contains Georgian), so no pairing.
    expect(first).toEqual({ kind: 'lyric', text: 'დიდი     D' });
  });

  it('keeps a trailing chord that overhangs the lyric', () => {
    const [first] = parseChordSheet('G        D\nდიდი');
    expect(first).toEqual({
      kind: 'pair',
      columns: [
        { chord: 'G', text: 'დიდი' },
        { chord: 'D', text: '' },
      ],
    });
  });

  it('normalises CRLF', () => {
    expect(parseChordSheet('G\r\nდიდი')).toEqual([
      { kind: 'pair', columns: [{ chord: 'G', text: 'დიდი' }] },
    ]);
  });
});

describe('isSectionLine — Georgian markers', () => {
  it('recognises the words actually used in these sheets', () => {
    expect(isSectionLine('მისამღერი')).toBe(true);
    expect(isSectionLine('[ხიდი]')).toBe(true);
    expect(isSectionLine('ლექსი 2')).toBe(true);
  });

  it('still rejects a lyric that merely starts with a Georgian word', () => {
    expect(isSectionLine('დიდია ღმერთი')).toBe(false);
  });
});

describe('groupColumns', () => {
  const columns = (source: string) => {
    const line = parseChordSheet(source)[0];
    if (line?.kind !== 'pair') throw new Error('expected a pair');
    return line.columns;
  };

  /** What each group renders as one unbreakable run of text. */
  const texts = (source: string) =>
    groupColumns(columns(source)).map((group) => group.map((column) => column.text).join(''));

  /** A chord mid-word must not let the browser wrap inside that word. */
  it('keeps a word split by a chord in one group', () => {
    expect(texts('  G\nდიდია ღმერთი')).toEqual(['დიდია ', 'ღმერთი']);
  });

  it('breaks where a column ends on a space', () => {
    expect(texts('G     Em\nდიდია ღმერთი')).toEqual(['დიდია ', 'ღმერთი']);
  });

  /*
    The reason a phone got a sideways scrollbar instead of a second line: one
    chord at column 0 is the most ordinary line in any song, and it used to
    produce a single column with nowhere to break.
  */
  it('breaks a single-chord line at its word boundaries', () => {
    expect(texts('C#m\nაქ ვარ რომ გისმინო')).toEqual(['აქ ', 'ვარ ', 'რომ ', 'გისმინო']);
  });

  it('loses no text when splitting at words', () => {
    const source = 'G   C    Em  D\nდიდია ღმერთი ჩვენი აქ';
    expect(texts(source).join('')).toBe('დიდია ღმერთი ჩვენი აქ');
  });

  /** The whole point: gaining break points must not move a chord off its syllable. */
  it('leaves every chord on the character it started on', () => {
    const source = 'G     Em      D\nდიდია ღმერთი ჩვენი';
    const lyric = 'დიდია ღმერთი ჩვენი';

    let offset = 0;
    const placed: { chord: string; at: number }[] = [];
    for (const group of groupColumns(columns(source))) {
      for (const column of group) {
        if (column.chord !== '') placed.push({ chord: column.chord, at: offset });
        offset += column.text.length;
      }
    }

    expect(placed).toEqual([
      { chord: 'G', at: 0 },
      { chord: 'Em', at: 6 },
      { chord: 'D', at: 14 },
    ]);
    expect(lyric[6]).toBe('ღ');
    // Mid-word, inside "ჩვენი" — the case the grouping exists to protect.
    expect(lyric[14]).toBe('ვ');
  });

  it('does not split a column that is a single word', () => {
    expect(texts('  G\nდიდია')).toEqual(['დიდია']);
  });
});
