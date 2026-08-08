'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Search, Trash2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CHORD_CATALOG } from '@/lib/chords/catalog';
import { isChordToken } from '@/lib/chords/detect';

/**
 * The chord picker, opened by tapping a slot on the canvas.
 *
 * Presented as a bottom sheet rather than a centred dialog for one reason: on a
 * phone the thing you are placing a chord *onto* is what you need to keep
 * looking at. A sheet leaves the top of the screen — where the tapped line
 * scrolls to — visible, and puts the buttons under the thumb.
 *
 * The search field is not auto-focused. Raising the keyboard would cover the
 * grid that most taps are headed for, and the whole point of this surface is to
 * keep the keyboard down.
 */

const CATALOG = CHORD_CATALOG;

export function ChordPicker({
  open,
  onOpenChange,
  /** Pre-selected when changing an existing chord; absent when adding a new one. */
  current,
  suggested,
  onPick,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: string;
  /** Key chords and chords already in the song — offered before the full catalog. */
  suggested: string[];
  onPick: (chord: string) => void;
  onRemove?: () => void;
}) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  /**
   * Who gets focus on open, decided by input device rather than by width.
   *
   * A coarse pointer means a soft keyboard, and raising it would bury the grid
   * most taps are headed for. With a real keyboard the opposite is true: typing
   * `f#m` is the fastest route to a chord, so focus goes straight to search.
   * `pointer: coarse` is the honest test — a narrow desktop window is still a
   * mouse, and a large tablet is still a finger.
   */
  const handleOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    if (window.matchMedia('(pointer: coarse)').matches) return;
    searchRef.current?.focus();
  };

  // A stale query from the last open is confusing — it hides the suggestions the
  // next tap probably wants.
  useEffect(() => {
    if (open) {
      setQuery('');
      listRef.current?.scrollTo({ top: 0 });
    }
  }, [open]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed === '') return null;

    const lower = trimmed.toLowerCase();
    const matches = CATALOG.filter((chord) => chord.toLowerCase().startsWith(lower));

    // Anything the sheet parser would accept is offerable, even if it is not in
    // the catalog — slash chords and stacked extensions are real and endless.
    if (matches.length === 0 && isChordToken(trimmed)) return [trimmed];
    return matches;
  }, [query]);

  const pick = (chord: string) => {
    onPick(chord);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          /*
            A sheet on touch, a dialog on a pointer.

            The bottom sheet is right on a phone — thumb reach, and it leaves the
            line you tapped visible above it. Stretched to a 1900px desktop it is
            neither: the grid becomes 25 columns of near-identical tokens, which
            is a worse way to find Am than a list half the size.
          */
          onOpenAutoFocus={handleOpenAutoFocus}
          className={cn(
            'fixed z-50 flex flex-col border-border bg-background shadow-2xl',
            'inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]',
            'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[70vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:pb-0',
            'data-[state=closed]:animate-out data-[state=open]:animate-in',
            'max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:slide-in-from-bottom',
            'md:data-[state=closed]:fade-out-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:fade-in-0 md:data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <DialogPrimitive.Title className="text-sm font-medium">
              {current ? `${current} — შეცვლა` : 'აკორდის დამატება'}
            </DialogPrimitive.Title>

            <div className="ml-auto flex items-center gap-1">
              {onRemove && (
                <button
                  type="button"
                  onClick={() => {
                    onRemove();
                    onOpenChange(false);
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                  მოხსნა
                </button>
              )}
              <DialogPrimitive.Close
                aria-label="დახურვა"
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 dark:bg-input/30">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const first = results?.[0];
                  if (first) pick(first);
                }}
                placeholder="ძებნა — მაგ. F#m7, Bb, Dsus4"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                // 16px minimum, or iOS zooms the page on focus.
                className="h-10 min-w-0 flex-1 bg-transparent font-mono text-base outline-none placeholder:font-sans placeholder:text-muted-foreground"
              />
              {query !== '' && (
                <button
                  type="button"
                  aria-label="ძებნის გასუფთავება"
                  onClick={() => setQuery('')}
                  className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {results === null ? (
              <>
                {suggested.length > 0 && (
                  <Group label="ამ სიმღერასა და ტონალობაში">
                    {suggested.map((chord) => (
                      <ChordButton
                        key={chord}
                        chord={chord}
                        selected={chord === current}
                        onClick={() => pick(chord)}
                      />
                    ))}
                  </Group>
                )}

                <Group label="ყველა აკორდი">
                  {CATALOG.map((chord) => (
                    <ChordButton
                      key={chord}
                      chord={chord}
                      selected={chord === current}
                      onClick={() => pick(chord)}
                    />
                  ))}
                </Group>
              </>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                „{query.trim()}“-ს აკორდი არ ემთხვევა.
              </p>
            ) : (
              <Group label={`${results.length} ნაპოვნი`}>
                {results.map((chord) => (
                  <ChordButton
                    key={chord}
                    chord={chord}
                    selected={chord === current}
                    onClick={() => pick(chord)}
                  />
                ))}
              </Group>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">{label}</h4>
      {/* Fixed-width columns rather than flex-wrap: a chord grid that reflows as
          you type is very hard to aim at. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        {children}
      </div>
    </section>
  );
}

function ChordButton({
  chord,
  selected,
  onClick,
}: {
  chord: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-11 rounded-lg border font-mono text-sm font-semibold transition-colors active:translate-y-px',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-primary hover:bg-muted dark:bg-input/40',
      )}
    >
      {chord}
    </button>
  );
}
