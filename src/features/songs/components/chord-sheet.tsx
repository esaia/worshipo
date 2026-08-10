'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';
import { stripChords } from '@/lib/chords/strip';
import { SheetLines } from './sheet-lines';

/**
 * The reader's size steps.
 *
 * Shifted up a notch from `text-sm`–`text-2xl`: the bottom of that range was set
 * for reading a phone at desk distance, and nobody reads a chord sheet at desk
 * distance. It is on a stand, or in a hand at the end of an arm, and 14px of
 * Georgian at that range is guesswork. `text-base` is the honest floor, and the
 * extra step at the top is what a sheet propped on a piano actually needs.
 */
const SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'] as const;

/**
 * Chord size as a multiple of the lyric size, not an absolute one.
 *
 * The two settings are independent because they answer different questions. How
 * big the lyrics are is about eyesight and how far away the phone is. How big
 * the chords are is about which of the two you are actually reading: a singer
 * wants them out of the way, a guitarist learning the song wants them level with
 * the words. Tying them together forces one answer on both.
 */
const CHORD_SCALES = [0.6, 0.72, 0.86, 1] as const;

const DEFAULT_SIZE = 1;
const DEFAULT_CHORD_SCALE = 1;

const SIZE_KEY = 'worshipo:sheet-size';
const CHORD_KEY = 'worshipo:chord-size';

/** Reads a persisted index, falling back when it is missing or out of range. */
function storedIndex(key: string, length: number, fallback: number): number {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value < length ? value : fallback;
}

/**
 * The performance view — what someone reads while holding a guitar.
 *
 * Client component for three browser-only reasons: the reader's size settings
 * persisted to localStorage, the wake lock, and the clipboard.
 */
export function ChordSheet({ source }: { source: string }) {
  const [sizeIndex, setSizeIndex] = useState(DEFAULT_SIZE);
  const [chordIndex, setChordIndex] = useState(DEFAULT_CHORD_SCALE);

  // Read after mount, not during render: localStorage does not exist on the
  // server and reading it during render would desync hydration.
  useEffect(() => {
    setSizeIndex(storedIndex(SIZE_KEY, SIZES.length, DEFAULT_SIZE));
    setChordIndex(storedIndex(CHORD_KEY, CHORD_SCALES.length, DEFAULT_CHORD_SCALE));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIZE_KEY, String(sizeIndex));
  }, [sizeIndex]);

  useEffect(() => {
    window.localStorage.setItem(CHORD_KEY, String(chordIndex));
  }, [chordIndex]);

  // Keep the screen awake while a song is open. Best-effort: unsupported in
  // some browsers, and the request is rejected if the tab is backgrounded.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
        if (cancelled) void sentinel?.release();
      } catch {
        // No wake lock available. Not worth telling the user about.
      }
    };

    void request();

    // The lock is dropped when the tab is hidden and must be re-taken on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, []);

  const size = SIZES[sizeIndex] ?? SIZES[DEFAULT_SIZE];
  const chordScale = CHORD_SCALES[chordIndex] ?? CHORD_SCALES[DEFAULT_CHORD_SCALE];

  if (source.trim() === '') {
    return <p className="text-sm text-muted-foreground">ტექსტი ჯერ არ არის.</p>;
  }

  return (
    <div className="space-y-3">
      {/*
        Wraps to two rows on a narrow phone: copying and resizing are both
        occasional, and neither is worth clipping the other off the edge.
      */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <CopyButton
            label="ტექსტის კოპირება"
            value={stripChords(source)}
            done="ტექსტი დაკოპირდა"
          />
          <CopyButton label="აკორდებთან ერთად" value={source} done="ფურცელი დაკოპირდა" />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <SizeGroup
            label="ტექსტი"
            atMin={sizeIndex === 0}
            atMax={sizeIndex === SIZES.length - 1}
            onSmaller={() => setSizeIndex((i) => Math.max(0, i - 1))}
            onLarger={() => setSizeIndex((i) => Math.min(SIZES.length - 1, i + 1))}
          />
          <SizeGroup
            label="აკორდები"
            atMin={chordIndex === 0}
            atMax={chordIndex === CHORD_SCALES.length - 1}
            onSmaller={() => setChordIndex((i) => Math.max(0, i - 1))}
            onLarger={() => setChordIndex((i) => Math.min(CHORD_SCALES.length - 1, i + 1))}
          />
        </div>
      </div>

      {/*
        Its own horizontal scroll container: a long chord line must never make
        the whole page scroll sideways on a phone.
      */}
      <SheetLines
        source={source}
        style={{ '--chord-scale': chordScale } as CSSProperties}
        className={cn('-mx-4 overflow-x-auto px-4', size)}
      />
    </div>
  );
}

/**
 * Copies to the clipboard and says so on the button itself.
 *
 * The tick is on the control that was pressed, not only in a toast: on a phone
 * held at arm's length a toast at the top of the screen is easy to miss, and
 * "did that work?" is the whole question a copy button has to answer.
 */
function CopyButton({ label, value, done }: { label: string; value: string; done: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    // `copyText` already falls back to the selection-based copy that plain-http
    // origins need; a failure here means both routes were refused.
    if (await copyText(value)) {
      setCopied(true);
      toast.success(done);
      return;
    }

    toast.error('კოპირება ვერ მოხერხდა. მონიშნეთ ტექსტი და ხელით დააკოპირეთ.');
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8"
    >
      {copied ? <Check className="size-3.5 text-foreground" /> : <Copy className="size-3.5" />}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function SizeGroup({
  label,
  atMin,
  atMax,
  onSmaller,
  onLarger,
}: {
  label: string;
  atMin: boolean;
  atMax: boolean;
  onSmaller: () => void;
  onLarger: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {/*
        Sized `A`s rather than `+ / −`: with two of these side by side the
        glyphs have to say what they change without a second label.
      */}
      <div
        role="group"
        aria-label={`${label} — ზომა`}
        className="inline-flex items-center overflow-hidden rounded-lg border border-border"
      >
        <SizeButton label={`${label} — შემცირება`} disabled={atMin} onClick={onSmaller}>
          <span className="text-xs">A</span>
        </SizeButton>

        <span aria-hidden className="h-5 w-px bg-border" />

        <SizeButton label={`${label} — გადიდება`} disabled={atMax} onClick={onLarger}>
          <span className="text-base">A</span>
        </SizeButton>
      </div>
    </div>
  );
}

function SizeButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 md:size-8"
    >
      {children}
    </button>
  );
}
