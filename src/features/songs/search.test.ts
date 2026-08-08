import { describe, expect, it } from 'vitest';

import { parseSearchParams, parseSnippet, toCategories } from './search';

describe('parseSearchParams', () => {
  it('reads a query and a category list off the URL', () => {
    expect(parseSearchParams({ q: 'დიდია', categories: 'a,b' })).toEqual({
      query: 'დიდია',
      categoryIds: ['a', 'b'],
    });
  });

  it('treats a missing or blank query as no query', () => {
    expect(parseSearchParams({})).toEqual({ query: '', categoryIds: [] });
    expect(parseSearchParams({ q: '   ' }).query).toBe('');
  });

  it('drops empty ids from a trailing or doubled comma', () => {
    expect(parseSearchParams({ categories: 'a,,b,' }).categoryIds).toEqual(['a', 'b']);
  });

  it('takes the first value when a param is repeated', () => {
    expect(parseSearchParams({ q: ['first', 'second'] }).query).toBe('first');
  });
});

describe('parseSnippet', () => {
  it('splits a headline into matched and unmatched segments', () => {
    expect(parseSnippet('the <mark>lord</mark> reigns')).toEqual([
      { text: 'the ', match: false },
      { text: 'lord', match: true },
      { text: ' reigns', match: false },
    ]);
  });

  it('handles a match at each end and several matches', () => {
    expect(parseSnippet('<mark>a</mark> b <mark>c</mark>')).toEqual([
      { text: 'a', match: true },
      { text: ' b ', match: false },
      { text: 'c', match: true },
    ]);
  });

  it('leaves markup in the lyrics as text — it is never treated as HTML', () => {
    // The whole reason this function exists: ts_headline does not escape the
    // source, so a song containing a tag must come back as characters.
    expect(parseSnippet('<script>alert(1)</script> <mark>hit</mark>')).toEqual([
      { text: '<script>alert(1)</script> ', match: false },
      { text: 'hit', match: true },
    ]);
  });

  it('spans a line break inside a match', () => {
    expect(parseSnippet('<mark>two\nlines</mark>')).toEqual([{ text: 'two\nlines', match: true }]);
  });

  it('returns a plain snippet unchanged, and nothing for an empty one', () => {
    expect(parseSnippet('no highlight')).toEqual([{ text: 'no highlight', match: false }]);
    expect(parseSnippet('')).toEqual([]);
  });
});

describe('toCategories', () => {
  it('keeps well-formed rows from the jsonb aggregate', () => {
    expect(toCategories([{ id: 'x', name: 'გუნდი', slug: 'gundi' }])).toHaveLength(1);
  });

  it('rejects anything that is not an array of category-shaped objects', () => {
    expect(toCategories(null)).toEqual([]);
    expect(toCategories('[]')).toEqual([]);
    expect(toCategories([null, 42, { id: 'x' }])).toEqual([]);
  });
});
