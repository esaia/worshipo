import { describe, expect, it } from 'vitest';

import { filterSlashItems, readSlashQuery, type SlashItem } from './slash';

describe('readSlashQuery', () => {
  it('opens on a slash at the start of a line', () => {
    expect(readSlashQuery('/', 1)).toEqual({ start: 0, query: '' });
  });

  it('collects what has been typed after the slash', () => {
    expect(readSlashQuery('აქ ვარ\n/მის', 11)).toEqual({ start: 7, query: 'მის' });
  });

  it('ignores indentation before the slash', () => {
    expect(readSlashQuery('  /ver', 6)).toEqual({ start: 2, query: 'ver' });
  });

  /** A slash chord must never open a menu. */
  it('does not open on a slash inside a chord', () => {
    expect(readSlashQuery('D/F#', 4)).toBeNull();
  });

  it('does not open on a slash inside a lyric', () => {
    expect(readSlashQuery('შენ/ჩემი', 8)).toBeNull();
  });

  it('closes once a space is typed', () => {
    expect(readSlashQuery('/მის ', 5)).toBeNull();
  });

  it('closes when the caret moves off the line', () => {
    expect(readSlashQuery('/მის\nსხვა', 9)).toBeNull();
  });

  /** Chords are placed mid-line, so the menu has to open there too. */
  it('opens after whitespace in the middle of a chord line', () => {
    expect(readSlashQuery('F#m   /', 7)).toEqual({ start: 6, query: '' });
  });

  it('collects a query typed mid-line', () => {
    expect(readSlashQuery('F#m   /am', 9)).toEqual({ start: 6, query: 'am' });
  });

  it('returns null when there is no slash at all', () => {
    expect(readSlashQuery('დიდია ღმერთი', 5)).toBeNull();
  });
});

describe('filterSlashItems', () => {
  const items: SlashItem[] = [
    { kind: 'section', label: 'ლექსი', keywords: ['verse', 'leksi'], hint: 'verse' },
    { kind: 'section', label: 'მისამღერი', keywords: ['chorus', 'misamgheri'], hint: 'chorus' },
    { kind: 'section', label: 'ხიდი', keywords: ['bridge', 'khidi'], hint: 'bridge' },
  ];

  it('keeps the authored order when nothing is typed', () => {
    expect(filterSlashItems(items, '')).toEqual(items);
  });

  it('matches the Georgian label', () => {
    expect(filterSlashItems(items, 'ხიდ').map((item) => item.label)).toEqual(['ხიდი']);
  });

  /** Typing on a Latin keyboard has to reach a Georgian label. */
  it('matches a Latin keyword', () => {
    expect(filterSlashItems(items, 'chor').map((item) => item.label)).toEqual(['მისამღერი']);
  });

  it('returns nothing when the query matches nothing', () => {
    expect(filterSlashItems(items, 'zzz')).toEqual([]);
  });
});
