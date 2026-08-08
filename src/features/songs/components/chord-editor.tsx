'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, Eraser, Pilcrow } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  insertChord,
  insertSection,
  insertText,
  nudgeChord,
  outdent,
  removeChord,
  undoAutoPeriod,
  type EditResult,
} from '@/lib/chords/edit';
import { CHORD_CATALOG } from '@/lib/chords/catalog';
import { normalizePastedSheet } from '@/lib/chords/paste';
import { filterSlashItems, readSlashQuery, type SlashItem } from '@/lib/chords/slash';
import { caretPoint } from '@/lib/textarea-caret';
import { chordPalette, chordsInUse } from '@/lib/chords/suggest';
import { ChordCanvas } from './chord-canvas';
import { SlashMenu } from './slash-menu';
import { SheetLines } from './sheet-lines';

/**
 * The chord sheet editor.
 *
 * The storage format is deliberately dumb — chord lines above lyric lines,
 * columns set by spaces — because that is what a musician reads off paper and
 * what every other songbook exports. It is also miserable to type on a phone:
 * counting spaces with a soft keyboard in the way is the reason sheets get
 * entered wrong or not at all.
 *
 * So the format stays; the counting goes. Each mode owns one job:
 *
 * - **Write is for words.** It is a plain textarea and nothing else. It used to
 *   carry a scrolling strip of chord chips above it, which was a duplicate of
 *   the Chords tab wearing a worse interface — it ate a row of vertical space on
 *   every phone, on the one screen where vertical space is already fought over
 *   by the soft keyboard, in service of a job the next tab does properly. Chords
 *   are still reachable from here by typing `/`, which costs nothing when unused.
 * - **Chords is for placing them.** Point at the syllable; see `ChordCanvas`.
 * - **Preview proves it.** Renders through the same `SheetLines` as the
 *   performance view, so alignment is verified against the real thing rather
 *   than against monospace columns that lie about Georgian text.
 *
 * Two details the whole surface depends on:
 *
 * - **Toolbar sticks to the top.** On a phone the keyboard owns the bottom of
 *   the screen and the browser scrolls the caret upward to stay clear of it; a
 *   top-anchored toolbar is the only one still on screen while typing.
 * - **Buttons cancel `mousedown`.** Tapping one otherwise blurs the textarea,
 *   which dismisses the keyboard and drops the selection. Preventing the default
 *   keeps focus (and the caret) exactly where it was.
 * - **Nudge / erase** operate on the chord nearest the caret, because being one
 *   column off is the single most common correction.
 *
 * The component is controlled. An earlier version used RHF's `register()` and an
 * uncontrolled textarea, which cannot work here: every button above has to read
 * the current value and write a new one with a chosen caret position.
 */

/**
 * Section markers, with the Latin words that should find them.
 *
 * The keywords are not decoration: the labels are Georgian, and an admin whose
 * keyboard is in Latin at that moment — which it is, because they were just
 * typing chords — otherwise cannot reach them by typing at all.
 */
const SECTIONS: Record<'ka' | 'en', SlashItem[]> = {
  ka: [
    { kind: 'section', label: 'ლექსი', keywords: ['verse', 'leksi'], hint: 'verse' },
    { kind: 'section', label: 'მისამღერი', keywords: ['chorus', 'misamgheri'], hint: 'chorus' },
    { kind: 'section', label: 'ხიდი', keywords: ['bridge', 'khidi'], hint: 'bridge' },
  ],
  en: [
    { kind: 'section', label: 'Verse', keywords: ['verse'], hint: 'section' },
    { kind: 'section', label: 'Chorus', keywords: ['chorus'], hint: 'section' },
    { kind: 'section', label: 'Bridge', keywords: ['bridge'], hint: 'section' },
  ],
};

/** How many chord rows the menu will show. Enough to choose from, few enough to scan. */
const SLASH_CHORD_LIMIT = 6;

const TAB = '  ';

/**
 * Write types the words, Chords places them, Preview proves it.
 *
 * Chords is a separate mode rather than an overlay on the textarea because the
 * two want opposite things from the phone: typing needs the soft keyboard up,
 * and placing chords needs it down and the whole line visible.
 */
type Mode = 'write' | 'chords' | 'preview';

const MODES: Mode[] = ['write', 'chords', 'preview'];

const MODE_LABELS: Record<Mode, string> = {
  write: 'წერა',
  chords: 'აკორდები',
  preview: 'გადახედვა',
};

const HINTS: Record<Mode, string> = {
  write: 'აკორდის ან სექციისთვის აკრიფეთ /.',
  chords: 'აკორდის დასამატებლად დააჭირეთ ასოს. გადასატანად გადაათრიეთ.',
  preview: 'ასე წაიკითხება.',
};

export function ChordEditor({
  id,
  name,
  value,
  onChange,
  onBlur,
  songKey = '',
  language = 'ka',
  invalid,
  describedBy,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Drives which chords the palette offers. */
  songKey?: string;
  language?: 'ka' | 'en';
  invalid?: boolean;
  describedBy?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelection = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>('write');

  /** Whether the section chips are showing. Closed by default — they are rarely needed. */
  const [sectionsOpen, setSectionsOpen] = useState(false);

  const palette = useMemo(() => chordPalette(songKey, value), [songKey, value]);
  const sections = SECTIONS[language] ?? SECTIONS.en;

  // A programmatic edit changes the value first and the caret second: React has
  // to have written the new text into the DOM before a selection into it means
  // anything.
  useEffect(() => {
    const selection = pendingSelection.current;
    if (selection === null) return;
    pendingSelection.current = null;

    const element = textareaRef.current;
    if (!element) return;

    element.focus({ preventScroll: true });
    element.setSelectionRange(selection, selection);
  }, [value]);

  const apply = (edit: (value: string, caret: number) => EditResult) => {
    const element = textareaRef.current;
    if (!element) return;

    const result = edit(element.value, element.selectionStart);
    pendingSelection.current = result.selection;
    onChange(result.value);

    // The value may be unchanged (nudging a chord already at column 0), and then
    // no re-render arrives to run the effect. Restore focus here too.
    if (result.value === element.value) {
      element.focus({ preventScroll: true });
      element.setSelectionRange(result.selection, result.selection);
      pendingSelection.current = null;
    }
  };

  /**
   * The open `/` menu, or null.
   *
   * Held in state rather than derived during render because it needs the caret,
   * and the caret lives on the DOM node — it is not part of `value`. Recomputed
   * on every event that can move it.
   */
  const [slash, setSlash] = useState<{
    start: number;
    items: SlashItem[];
    point: { top: number; left: number };
  } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  /**
   * The rows the menu offers for a query: sections first, then chords.
   *
   * Sections lead because there are only three of them and they are the reason
   * the menu exists on a lyric line. Chords come from the song's own palette
   * before the full catalog, so `/a` offers the A the song already uses ahead of
   * Aadd9 — the same ordering the chord strip above uses.
   */
  const slashItems = (query: string): SlashItem[] => {
    const chords = query === '' ? palette : [...palette, ...CHORD_CATALOG];

    const seen = new Set<string>();
    const chordItems: SlashItem[] = [];

    for (const chord of chords) {
      if (seen.has(chord)) continue;
      if (query !== '' && !chord.toLowerCase().startsWith(query)) continue;

      seen.add(chord);
      chordItems.push({ kind: 'chord', label: chord, keywords: [], hint: 'აკორდი' });
      if (chordItems.length === SLASH_CHORD_LIMIT) break;
    }

    return [...filterSlashItems(sections, query), ...chordItems];
  };

  const refreshSlash = (element: HTMLTextAreaElement) => {
    const query = readSlashQuery(element.value, element.selectionStart);
    if (!query) {
      setSlash(null);
      return;
    }

    const items = slashItems(query.query);
    if (items.length === 0) {
      setSlash(null);
      return;
    }

    // Anchored to the slash, not the caret, so the menu holds still while the
    // query is typed instead of creeping right character by character.
    const point = caretPoint(element, query.start);
    setSlash({
      start: query.start,
      items,
      point: { top: point.top + point.lineHeight, left: point.left },
    });
    setSlashIndex((current) => Math.min(current, items.length - 1));
  };

  /**
   * Takes the typed `/query` out and puts the chosen thing in its place.
   *
   * A section is literal text — it belongs on the line being typed. A chord is
   * not: it belongs on the chord line governing the caret, which may need
   * creating. So the query is deleted first and the result handed to
   * `insertChord`, which already knows where a chord goes from any caret. Typing
   * `/am` on a chord line edits that line in place; typing it on a lyric opens a
   * chord line above. Neither case needs special handling here.
   */
  const chooseSlashItem = (item: SlashItem) => {
    const element = textareaRef.current;
    if (!element || !slash) return;

    const { start } = slash;
    const end = element.selectionStart;

    setSlash(null);
    setSlashIndex(0);

    if (item.kind === 'section') {
      apply((current) => insertText(current, start, end, item.label));
      return;
    }

    apply((current) => {
      const cleared = insertText(current, start, end, '');
      return insertChord(cleared.value, cleared.selection, item.label);
    });
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const caret = element.selectionStart;
    const corrected = undoAutoPeriod(value, element.value, caret);

    // Read from the element after the keystroke, before React re-renders it.
    refreshSlash(element);

    if (corrected === null) {
      onChange(element.value);
      return;
    }

    // Two characters swapped for two characters, so the caret does not move —
    // it just has to be re-applied over the corrected value.
    pendingSelection.current = caret;
    onChange(corrected);
  };

  /**
   * Un-double-spaces a sheet pasted from elsewhere.
   *
   * Chord sheets on the web are almost always rendered with a blank line between
   * every line, which reads well on a page and is broken here — a chord line is
   * bound to its lyric by sitting immediately above it, so the blank unpairs
   * every chord in the song.
   *
   * Falls through to the browser's own paste when there is nothing to fix, which
   * keeps native undo working for the ordinary case.
   */
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text/plain');
    if (pasted === '') return;

    const cleaned = normalizePastedSheet(pasted);
    if (cleaned === pasted) return;

    event.preventDefault();
    const { selectionStart, selectionEnd } = event.currentTarget;
    apply((current) => insertText(current, selectionStart, selectionEnd, cleaned));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    /*
      The menu owns these keys while it is open, and only while it is open.
      Enter has to keep inserting a newline the rest of the time, and Escape has
      to keep doing nothing — swallowing either unconditionally would break
      ordinary typing to serve a menu that is usually closed.
    */
    if (slash) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const count = slash.items.length;
        // Wraps, because a three-item list is faster to cycle than to clamp.
        setSlashIndex((current) => (current + step + count) % count);
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = slash.items[slashIndex];
        if (item) {
          event.preventDefault();
          chooseSlashItem(item);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setSlash(null);
        return;
      }
    }

    // Tab indents instead of leaving the field: chord alignment is done with
    // spaces, and losing focus mid-line is maddening.
    if (event.key !== 'Tab') return;
    event.preventDefault();

    const element = event.currentTarget;
    const { selectionStart, selectionEnd } = element;

    apply((current, caret) =>
      event.shiftKey
        ? outdent(current, caret, TAB.length)
        : insertText(current, selectionStart, selectionEnd, TAB),
    );
  };

  const stats = useMemo(() => {
    const lines = value === '' ? 0 : value.split('\n').filter((line) => line.trim() !== '').length;
    const chords = chordsInUse(value).length;
    return { lines, chords };
  }, [value]);

  return (
    <div
      data-invalid={invalid ? '' : undefined}
      className="overflow-hidden rounded-xl border border-input bg-background transition-colors focus-within:border-ring data-invalid:border-destructive dark:bg-input/30"
    >
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur dark:bg-card/95">
        {/*
          Wraps rather than scrolls. Three tabs plus four tools overflow a phone
          by roughly 30px, and the casualty is always the rightmost tool — the
          eraser — because it sits at the end of the row. Letting the group drop
          to its own line keeps every control reachable at any width, at the cost
          of one row of height on the narrowest screens only.
        */}
        <div className="flex flex-wrap items-center gap-y-2 px-2 py-2">
          <Tabs mode={mode} onChange={setMode} />

          <div className="ml-auto flex items-center gap-1">
            <ToolButton
              label="სექციის ჩასმა"
              disabled={mode !== 'write'}
              pressed={sectionsOpen}
              onClick={() => setSectionsOpen((open) => !open)}
            >
              <Pilcrow className="size-4" />
            </ToolButton>

            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />

            <ToolButton
              label="აკორდის მარცხნივ წევა"
              disabled={mode !== 'write'}
              onClick={() => apply((current, caret) => nudgeChord(current, caret, -1))}
            >
              <ChevronLeft className="size-4" />
            </ToolButton>
            <ToolButton
              label="აკორდის მარჯვნივ წევა"
              disabled={mode !== 'write'}
              onClick={() => apply((current, caret) => nudgeChord(current, caret, 1))}
            >
              <ChevronRight className="size-4" />
            </ToolButton>
            <ToolButton
              label="აკორდის მოხსნა"
              disabled={mode !== 'write'}
              onClick={() => apply(removeChord)}
            >
              <Eraser className="size-4" />
            </ToolButton>
          </div>
        </div>

        {mode === 'write' && sectionsOpen && (
          // Three fixed chips, so this row never scrolls and never clips.
          <div className="border-t border-border px-2 py-2">
            <div role="group" aria-label="სექციის ჩასმა" className="flex items-center gap-1.5">
              {sections.map((section) => (
                <Chip
                  key={section.label}
                  label={`სექციის ჩასმა: ${section.label}`}
                  className="min-w-0 flex-1 text-muted-foreground"
                  onClick={() => {
                    apply((current, caret) => insertSection(current, caret, section.label));
                    setSectionsOpen(false);
                  }}
                >
                  <span className="truncate">{section.label}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {mode === 'chords' && <ChordCanvas value={value} onChange={onChange} songKey={songKey} />}

      {mode === 'write' ? (
        // `relative` so the slash menu can be positioned at the caret inside it.
        <div className="relative">
          <textarea
            id={id}
            name={name}
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onBlur={() => {
              // Tapping a menu row cancels `mousedown`, so focus never actually
              // leaves for that case — anything else that blurs the field means
              // the menu's caret is gone and it has to close with it.
              setSlash(null);
              onBlur?.();
            }}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            // Clicking or arrowing away from the slash has to close the menu,
            // and neither fires `change`.
            onSelect={(event) => refreshSlash(event.currentTarget)}
            onScroll={(event) => {
              if (slash) refreshSlash(event.currentTarget);
            }}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            placeholder={`G           Em\nდიდია ღმერთი ჩვენი`}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            // `whitespace-pre` and a monospace font, because chord position *is*
            // the data — a wrapping proportional field would destroy it silently.
            className="block min-h-[45vh] w-full resize-y overflow-x-auto bg-transparent px-3 py-3 font-mono text-base leading-relaxed whitespace-pre outline-none placeholder:text-muted-foreground/50 md:min-h-72"
          />

          {slash && (
            <SlashMenu
              items={slash.items}
              activeIndex={slashIndex}
              point={slash.point}
              onSelect={chooseSlashItem}
              onActiveIndexChange={setSlashIndex}
            />
          )}
        </div>
      ) : mode === 'preview' ? (
        <div className="min-h-[45vh] overflow-x-auto px-3 py-3 md:min-h-72">
          {value.trim() === '' ? (
            <p className="text-sm text-muted-foreground">გადასახედი ჯერ არაფერია.</p>
          ) : (
            <SheetLines source={value} />
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="truncate">{HINTS[mode]}</span>
        <span className="shrink-0 tabular-nums">
          {stats.lines} სტრიქონი · {stats.chords} აკორდი
        </span>
      </div>
    </div>
  );
}

function Tabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div role="tablist" className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
      {MODES.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'h-8 rounded-[7px] px-2.5 text-sm font-medium transition-colors',
            mode === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {MODE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}

/**
 * `onMouseDown` preventDefault is the whole trick: without it the tap blurs the
 * textarea, the soft keyboard closes, and the caret the action depends on is
 * gone before the click handler runs.
 */
function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

function ToolButton({
  label,
  disabled,
  pressed,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  /** Renders the button as a toggle when present. */
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onClick}
      className={cn(
        'grid size-9 place-items-center rounded-lg border border-border transition-colors disabled:pointer-events-none disabled:opacity-40 md:size-8',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={keepFocus}
      onClick={onClick}
      // `min-w-11` keeps every chip a comfortable thumb target even when the
      // label is a single character.
      className={cn(
        'inline-grid h-9 min-w-11 shrink-0 place-items-center rounded-lg border border-border bg-background px-2.5 text-sm transition-colors hover:bg-muted active:translate-y-px dark:bg-input/40',
        className,
      )}
    >
      {children}
    </button>
  );
}
