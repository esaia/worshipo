'use client';

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { cn } from '@/lib/utils';
import {
  moveChord,
  putChord,
  readSheet,
  removeChordAt,
  type ChordTarget,
  type SheetRow,
} from '@/lib/chords/place';
import { chordPalette } from '@/lib/chords/suggest';
import { ChordPicker } from './chord-picker';

/**
 * Direct-manipulation chord placement.
 *
 * The textarea asks you to describe where a chord goes by counting spaces. This
 * asks you to point at it. Every chord is a draggable object sitting above the
 * character it belongs to, and every character is a target you can drop one on.
 *
 * Three decisions carry most of the design:
 *
 * - **Chords are absolutely positioned above their slot.** Laying them out in
 *   flow (as the read-only `SheetLines` does) would let a four-character chord
 *   stretch the one character beneath it and distort the lyric. Taking them out
 *   of flow means the words keep their natural spacing and the chord floats over
 *   the letter it names. Two chords written very close together can overlap —
 *   which is honest, because on paper they would too.
 *
 * - **Slots run past the end of the line.** `TRAILING` of them. A chord on the
 *   last beat, after the final syllable, is completely ordinary and was the one
 *   thing the textarea made genuinely painful: it required typing the trailing
 *   spaces by hand.
 *
 * - **Rows scroll horizontally rather than wrap.** Wrapping a lyric mid-word to
 *   fit the screen would put a chord above the wrong syllable, which is the one
 *   error this whole surface exists to prevent.
 */

/** Empty slots offered after the last character, for end-of-line chord changes. */
const TRAILING = 12;

/** Pointer travel, in px, over which a press stops being a tap and becomes a drag. */
const DRAG_THRESHOLD = 8;

/**
 * Shared by the badge and its drag ghost so the two cannot drift apart.
 *
 * Sized well above the chord's own text: this is a drag handle before it is a
 * label, and a fingertip covers roughly 9mm. The padding is what makes it
 * grabbable — the glyphs themselves are only a few millimetres tall.
 */
const BADGE =
  'absolute bottom-full left-0 rounded-md px-2 py-1.5 font-mono text-[0.95em] leading-none font-semibold whitespace-nowrap';

type Slot = { column: number; char: string };

/** A row's slot boxes, measured once per drag. */
type SlotBox = { column: number; left: number; right: number };

/** The column whose box contains `x`, clamped to the row at either end. */
function columnAt(boxes: SlotBox[], x: number): number {
  if (boxes.length === 0) return 0;

  const first = boxes[0]!;
  const last = boxes[boxes.length - 1]!;
  if (x < first.left) return first.column;
  if (x >= last.right) return last.column;

  const box = boxes.find((candidate) => x >= candidate.left && x < candidate.right);
  return box?.column ?? last.column;
}

type Editing =
  | { kind: 'add'; target: ChordTarget; column: number }
  | { kind: 'change'; target: ChordTarget; column: number; chord: string };

type Drag = {
  rowIndex: number;
  target: ChordTarget;
  from: number;
  to: number;
  chord: string;
  moved: boolean;
  /** Viewport x of the pointer. There is no y: a chord only ever moves along its own line. */
  x: number;
  /** Where inside the badge it was grabbed, so that spot stays under the pointer. */
  grabX: number;
  /** The badge's own top edge, held constant for the whole drag. */
  baseY: number;
};

export function ChordCanvas({
  value,
  onChange,
  songKey = '',
}: {
  value: string;
  onChange: (value: string) => void;
  songKey?: string;
}) {
  const rows = useMemo(() => readSheet(value), [value]);
  const suggested = useMemo(() => chordPalette(songKey, value), [songKey, value]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const slotBoxes = useRef<SlotBox[]>([]);
  const container = useRef<HTMLDivElement | null>(null);

  const targetOf = (row: SheetRow): ChordTarget =>
    row.kind === 'chords' ? { chordLineIndex: row.lineIndex } : { lyricLineIndex: row.lineIndex };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    rowIndex: number,
    row: SheetRow,
    column: number,
    chord: string,
  ) => {
    // Left button / touch / pen only, and never while the picker is open.
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    origin.current = { x: event.clientX, y: event.clientY };

    // Measured at grab time: the badge then travels with the pointer instead of
    // jumping so its left edge meets the cursor.
    const rect = event.currentTarget.getBoundingClientRect();

    slotBoxes.current = [
      ...(container.current?.querySelectorAll<HTMLElement>(`[data-slot-row="${rowIndex}"]`) ?? []),
    ].map((element) => {
      const box = element.getBoundingClientRect();
      return { column: Number(element.dataset.slotColumn), left: box.left, right: box.right };
    });

    const next: Drag = {
      rowIndex,
      target: targetOf(row),
      from: column,
      to: column,
      chord,
      moved: false,
      x: event.clientX,
      grabX: event.clientX - rect.left,
      baseY: rect.top,
    };
    dragRef.current = next;
    setDrag(next);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    const start = origin.current;
    if (!current || !start) return;

    if (!current.moved) {
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (distance < DRAG_THRESHOLD) return;
      current.moved = true;
    }

    current.x = event.clientX;

    /*
      Column is resolved against the row's measured slot geometry, by x alone.

      `elementFromPoint` was the obvious approach and the wrong one: the badge
      floats above the character row, so a horizontal drag probes empty padding
      and matches no slot at all — and where it does hit something, it hits the
      dragged badge itself, whose closest slot is the one it started in.

      The x used is the badge's left edge, not the pointer. Those differ by
      however far into the badge you grabbed, and using the pointer would drop a
      chord seized by its right edge a character or two late.
    */
    current.to = columnAt(slotBoxes.current, event.clientX - current.grabX);
    setDrag({ ...current });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>, row: SheetRow) => {
    const current = dragRef.current;
    dragRef.current = null;
    origin.current = null;
    setDrag(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current) return;

    // A press that never travelled is a tap: open the picker on that chord.
    if (!current.moved) {
      setEditing({
        kind: 'change',
        target: targetOf(row),
        column: current.from,
        chord: current.chord,
      });
      return;
    }

    if (current.to !== current.from) {
      onChange(moveChord(value, current.target, current.from, current.to));
    }
  };

  return (
    <>
      <div ref={container} className="min-h-[45vh] overflow-x-auto px-3 py-3 md:min-h-72">
        {rows.map((row, rowIndex) => {
          if (row.kind === 'blank') return <div key={rowIndex} className="h-4" aria-hidden />;

          if (row.kind === 'section') {
            return (
              // Same section marker as the performance view, so the editor and
              // the stage read as one document.
              <h3 key={rowIndex} className="mt-6 mb-2 flex items-center gap-3 first:mt-0">
                <span className="inline-flex items-center rounded-full bg-foreground px-[0.7em] py-[0.2em] text-[0.7em] leading-normal font-semibold tracking-[0.06em] text-background">
                  {row.text}
                </span>
                <span aria-hidden className="h-px flex-1 bg-border" />
              </h3>
            );
          }

          const text = row.kind === 'lyric' ? row.text : '';
          const lastChord = row.tokens.reduce(
            (end, token) => Math.max(end, token.index + token.chord.length),
            0,
          );

          const slots: Slot[] = Array.from(
            { length: Math.max(text.length, lastChord) + TRAILING },
            (_, column) => ({ column, char: text[column] ?? ' ' }),
          );

          const dragging = drag?.rowIndex === rowIndex && drag.moved ? drag : null;

          /*
            The badge being dragged stays rendered in its original slot, faded,
            for the whole gesture. Re-keying it to the target column would
            unmount the button mid-drag, and the pointer capture — which is what
            keeps `pointermove` firing once the cursor leaves the badge — dies
            with the element it was taken on. The drag would stick after a few
            pixels. What follows the cursor is the floating copy below.
          */
          const chordAt = new Map(row.tokens.map((token) => [token.index, token.chord]));

          return (
            // Top padding reserves the badge's full height; too little and a
            // chord clips into the line above it.
            <div key={rowIndex} className="flex w-max pt-9 leading-relaxed">
              {slots.map(({ column, char }) => {
                const chord = chordAt.get(column);
                const lifted = dragging?.from === column;
                const ghosted = dragging !== null && dragging.to === column;

                return (
                  <span
                    key={column}
                    data-slot-row={rowIndex}
                    data-slot-column={column}
                    className="relative"
                  >
                    {/* Where it will land: a caret in the text, not a second
                        copy of the badge. The badge is already under the cursor,
                        and two of them competing for the eye made it unclear
                        which one was the real one. */}
                    {ghosted && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-2 bottom-0 -left-px z-20 w-0.5 rounded-full bg-primary"
                      />
                    )}

                    {chord !== undefined && (
                      <button
                        type="button"
                        aria-label={`აკორდი ${chord} — შესაცვლელად დააჭირეთ, გადასატანად გადაათრიეთ`}
                        onPointerDown={(event) =>
                          handlePointerDown(event, rowIndex, row, column, chord)
                        }
                        onPointerMove={handlePointerMove}
                        onPointerUp={(event) => handlePointerUp(event, row)}
                        onPointerCancel={() => {
                          dragRef.current = null;
                          origin.current = null;
                          setDrag(null);
                        }}
                        // `touch-none` stops the browser claiming the gesture as a
                        // scroll before the drag is recognised.
                        className={cn(
                          BADGE,
                          'z-10 touch-none transition-opacity',
                          lifted
                            ? 'text-primary opacity-30'
                            : 'bg-primary/15 text-primary active:bg-primary/30',
                        )}
                      >
                        {chord}
                      </button>
                    )}

                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`აკორდის დამატება პოზიციაზე ${column + 1}`}
                      onClick={() => setEditing({ kind: 'add', target: targetOf(row), column })}
                      className={cn(
                        'block h-[1.6em] whitespace-pre transition-colors',
                        // A drop target only lights up while something is being
                        // dragged; a permanently striped lyric is unreadable.
                        dragging ? 'bg-primary/5' : 'hover:bg-primary/10 active:bg-primary/15',
                        char === ' ' && 'min-w-[0.4em]',
                      )}
                    >
                      {char}
                    </button>
                  </span>
                );
              })}
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            აკორდების დასასმელი ჯერ არაფერია — ჯერ „წერა“-ში დაამატეთ ტექსტი.
          </p>
        )}
      </div>

      {/*
        The badge under the cursor — horizontally only.

        `left` tracks the pointer minus the grab offset, so the spot you grabbed
        stays under it. `top` is frozen at the badge's own position, because a
        chord belongs to one line and the only question a drag answers is *which
        syllable*. Letting it follow the cursor vertically implied it could
        change lines, and made it overlap the lyrics it was meant to sit above.
      */}
      {drag?.moved && (
        <div
          aria-hidden
          style={{ left: drag.x - drag.grabX, top: drag.baseY }}
          className={cn(
            BADGE,
            'pointer-events-none fixed z-50 bg-primary text-primary-foreground shadow-xl',
            // `BADGE` anchors to a slot; this copy is positioned in the viewport.
            'bottom-auto',
          )}
        >
          {drag.chord}
        </div>
      )}

      <ChordPicker
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        current={editing?.kind === 'change' ? editing.chord : undefined}
        suggested={suggested}
        onPick={(chord) => {
          if (!editing) return;
          onChange(putChord(value, editing.target, editing.column, chord));
        }}
        onRemove={
          editing?.kind === 'change'
            ? () => onChange(removeChordAt(value, editing.target, editing.column))
            : undefined
        }
      />
    </>
  );
}
