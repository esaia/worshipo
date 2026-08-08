import { describe, expect, it } from 'vitest';

import { normalizePastedSheet } from './paste';

describe('normalizePastedSheet', () => {
  it('collapses the blank line between a chord line and its lyric', () => {
    const pasted = ['B', '', 'მე მიცავს ყოველდღე.', '', 'C#m', '', 'თავისუფლება მაჩუქე'].join('\n');

    expect(normalizePastedSheet(pasted)).toBe(
      ['B', 'მე მიცავს ყოველდღე.', 'C#m', 'თავისუფლება მაჩუქე'].join('\n'),
    );
  });

  /** A stanza break is two blanks in a double-spaced document; it has to survive as one. */
  it('keeps paragraph breaks', () => {
    const pasted = ['G', '', 'პირველი ხაზი', '', '', 'C', '', 'მეორე ხაზი'].join('\n');

    expect(normalizePastedSheet(pasted)).toBe(
      ['G', 'პირველი ხაზი', '', 'C', 'მეორე ხაზი'].join('\n'),
    );
  });

  it('leaves a normally spaced sheet completely alone', () => {
    const normal = ['G     Em', 'დიდია ღმერთი', '', 'C', 'უფალო ჩემო'].join('\n');
    expect(normalizePastedSheet(normal)).toBe(normal);
  });

  /**
   * Conservative on purpose: one pair of adjacent text lines means this is not a
   * uniformly double-spaced document, and touching it would be a guess.
   */
  it('leaves text alone when any two lines are already adjacent', () => {
    const mixed = ['G', 'დიდია ღმერთი', '', 'C', '', 'უფალო ჩემო'].join('\n');
    expect(normalizePastedSheet(mixed)).toBe(mixed);
  });

  it('does not treat a single blank line as a pattern', () => {
    const short = ['G', '', 'დიდია ღმერთი'].join('\n');
    expect(normalizePastedSheet(short)).toBe(short);
  });

  it('normalises CRLF line endings', () => {
    expect(normalizePastedSheet('G\r\nდიდია\r\n')).toBe('G\nდიდია\n');
  });

  it('drops leading and trailing blank runs down to nothing', () => {
    const pasted = ['', 'G', '', 'დიდია ღმერთი', '', 'C', '', 'უფალო', ''].join('\n');
    expect(normalizePastedSheet(pasted)).toBe(['G', 'დიდია ღმერთი', 'C', 'უფალო'].join('\n'));
  });
});
