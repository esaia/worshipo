'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Loader2, Search, X } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/domain';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { SEARCH_PAGE_SIZE, type SongSearchPage, type SongSearchParams } from '../search';
import { useSongSearch } from '../hooks/use-song-search';
import { SongResultCard } from './song-result-card';

const DEBOUNCE_MS = 250;

/**
 * The interactive half of `/songs`.
 *
 * The server renders page one from the URL; this takes over on the first
 * keystroke and drives the same card markup from React Query. The URL stays the
 * source of truth — a search is a place, so it has to survive a reload, a share,
 * and the back button.
 */
export function SongSearch({
  categories,
  initialParams,
  initialPage,
}: {
  categories: Category[];
  initialParams: SongSearchParams;
  initialPage: SongSearchPage;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // The input is local state, not URL state: re-rendering the whole route on
  // every keystroke would make typing feel heavy. The URL catches up on the
  // debounce, which is also when the query fires.
  const [text, setText] = useState(initialParams.query);
  const [categoryIds, setCategoryIds] = useState(initialParams.categoryIds);
  const [limit, setLimit] = useState(initialParams.limit);

  const query = useDebouncedValue(text, DEBOUNCE_MS);
  const params: SongSearchParams = { query, categoryIds, limit };

  const { data, isFetching, isError } = useSongSearch(params, {
    params: initialParams,
    page: initialPage,
  });

  // Skip the first run: on mount the URL already says what the server rendered,
  // and replacing it would push an identical entry over the user's history.
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const next = new URLSearchParams();
    if (query !== '') next.set('q', query);
    if (categoryIds.length > 0) next.set('categories', categoryIds.join(','));

    const search = next.toString();
    // `replace`, not `push`: every keystroke would otherwise be a history entry
    // and the back button would walk letter by letter out of the search.
    router.replace(search === '' ? pathname : `${pathname}?${search}`, { scroll: false });
  }, [query, categoryIds, pathname, router]);

  const toggleCategory = useCallback((id: string) => {
    setLimit(SEARCH_PAGE_SIZE);
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const results = data?.results ?? [];
  const total = data?.total ?? 0;
  const filtered = query !== '' || categoryIds.length > 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setLimit(SEARCH_PAGE_SIZE);
          }}
          placeholder="ძებნა სათაურებსა და ტექსტებში…"
          aria-label="სიმღერების ძებნა"
          autoComplete="off"
          className={cn(
            // `text-base` (16px) minimum: anything smaller makes iOS zoom the
            // viewport on focus, which is jarring to undo one-handed.
            'h-11 w-full rounded-lg border border-input bg-background pr-9 pl-9 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10 md:text-sm dark:bg-input/30',
            // `type="search"` earns the Escape-to-clear behaviour and the
            // right keyboard, but Blink and WebKit also draw their own clear
            // button — which sat next to ours. Hide theirs, keep ours: it is
            // styled, sized for a thumb, and exists in Firefox too.
            '[&::-webkit-search-cancel-button]:appearance-none',
          )}
        />
        {text !== '' && (
          <button
            type="button"
            aria-label="ძებნის გასუფთავება"
            onClick={() => setText('')}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/*
        Always visible rather than behind a toggle. There are few enough
        categories to fit in two rows, and hiding them hid the fact that the
        songbook can be filtered at all.
      */}
      {categories.length > 0 && (
        <div role="group" aria-label="კატეგორიები" className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const selected = categoryIds.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                  selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                )}
              >
                {selected && <Check className="size-3.5" aria-hidden />}
                {category.name}
              </button>
            );
          })}
          {categoryIds.length > 0 && (
            <button
              type="button"
              onClick={() => setCategoryIds([])}
              className="inline-flex min-h-9 items-center rounded-full px-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              გასუფთავება
            </button>
          )}
        </div>
      )}

      <div className="flex h-5 items-center justify-between text-xs text-muted-foreground">
        <span>
          {isError
            ? 'ძებნა ამჟამად მიუწვდომელია.'
            : filtered
              ? `${total} ნაპოვნი`
              : `${total} კრებულში`}
        </span>
        {isFetching && (
          <Loader2 className="size-3.5 animate-spin" aria-label="მიმდინარეობს ძებნა" />
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Search}
          title={filtered ? 'ვერაფერი მოიძებნა' : 'სიმღერები ჯერ არ არის'}
          description={
            filtered
              ? 'სცადეთ ნაკლები სიტყვა, ან მოხსენით კატეგორიის ფილტრი.'
              : 'კრებული ჯერჯერობით ცარიელია.'
          }
        />
      ) : (
        <>
          <ul
            className={cn(
              'divide-y divide-border rounded-xl border border-border transition-opacity',
              isFetching && 'opacity-60',
            )}
          >
            {results.map((song) => (
              <SongResultCard key={song.id} song={song} />
            ))}
          </ul>

          {results.length < total && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + SEARCH_PAGE_SIZE)}
              className="h-11 w-full rounded-lg border border-border text-sm font-medium transition-colors hover:bg-muted"
            >
              მეტის ჩვენება (დარჩა {total - results.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
