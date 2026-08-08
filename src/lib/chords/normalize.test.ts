import { describe, expect, it } from 'vitest';

import { normalizeSheet } from './normalize';

describe('normalizeSheet', () => {
  it('strips trailing spaces from every line', () => {
    expect(normalizeSheet('აქ ვარ   \nმე მიცავს  ')).toBe('აქ ვარ\nმე მიცავს');
  });

  it('leaves leading whitespace alone — it is the chord position', () => {
    expect(normalizeSheet('   C#m      B  \nსიყვარული შენი')).toBe('   C#m      B\nსიყვარული შენი');
  });

  it('keeps interior runs of spaces between chords', () => {
    expect(normalizeSheet('C     G     Am   ')).toBe('C     G     Am');
  });

  it('normalises CRLF and lone CR', () => {
    expect(normalizeSheet('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('keeps blank lines between stanzas but drops them from the end', () => {
    expect(normalizeSheet('a\n\nb\n\n  \n\n')).toBe('a\n\nb');
  });

  it('strips tabs at line end as well as spaces', () => {
    expect(normalizeSheet('a\t \t')).toBe('a');
  });

  it('is idempotent', () => {
    const once = normalizeSheet('  C   G  \nlyric line   \n\n');
    expect(normalizeSheet(once)).toBe(once);
  });

  it('leaves an already-clean sheet byte-identical', () => {
    const clean = '[ვერსი]\n   C#m\nაქ ვარ რომ გისმინო\n\n   B\nმე მიცავს.';
    expect(normalizeSheet(clean)).toBe(clean);
  });
});
