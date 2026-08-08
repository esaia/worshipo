'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { SlashItem } from '@/lib/chords/slash';

/**
 * The `/` menu, anchored at the caret.
 *
 * Positioned absolutely inside the textarea's wrapper rather than in a portal,
 * so it scrolls and clips with the field it belongs to. `pointer-events` stay on
 * for the rows — a phone has no arrow keys, and tapping the row you want has to
 * work — but the container cancels `mousedown`, which would otherwise blur the
 * textarea and destroy the caret the insertion depends on.
 */
export function SlashMenu({
  items,
  activeIndex,
  point,
  onSelect,
  onActiveIndexChange,
}: {
  items: SlashItem[];
  activeIndex: number;
  /** Caret position within the wrapper, in pixels. */
  point: { top: number; left: number };
  onSelect: (item: SlashItem) => void;
  onActiveIndexChange: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keyboard navigation can walk the selection out of view on a short list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (items.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="ჩასმა"
      onMouseDown={(event) => event.preventDefault()}
      style={{ top: point.top, left: point.left }}
      className="absolute z-30 max-h-56 w-52 overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1 shadow-lg"
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          data-active={index === activeIndex}
          // Hover moves the selection so the mouse and the arrow keys never
          // disagree about which row Enter will take.
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelect(item)}
          className={cn(
            'flex w-full items-baseline gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
            index === activeIndex ? 'bg-muted' : 'hover:bg-muted/60',
          )}
        >
          {/* Chords are set in the same mono face they will appear in on the
              sheet, so a row previews its own result. */}
          <span
            className={cn(
              'truncate text-sm font-medium',
              item.kind === 'chord' && 'font-mono font-semibold',
            )}
          >
            {item.label}
          </span>
          <span className="ml-auto shrink-0 text-[0.7rem] text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
