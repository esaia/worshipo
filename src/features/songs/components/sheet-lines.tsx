import { useMemo, type CSSProperties } from 'react';

import { groupColumns, parseChordSheet } from '@/lib/chords/parse';
import { cn } from '@/lib/utils';

/**
 * The rendered sheet, with no chrome around it.
 *
 * Shared by the performance view (`ChordSheet`) and the editor's preview tab, so
 * that what an admin approves while typing is character-for-character what a
 * musician sees on stage. Two renderers would drift apart within a week.
 *
 * The design problem this solves: a chord sheet is two documents interleaved.
 * One is read continuously (the words), the other is scanned ahead of where you
 * are (the chords). Setting both in the same weight and colour — which is what
 * this did — collapses them into one texture, and the reader has to parse every
 * line to work out which is which.
 *
 * So the chord layer is given a different *material* rather than a different
 * colour: a filled key cap, monospaced and small, sitting in a band of its own
 * above the lyric. Grayscale, because the app's palette is grayscale and a lone
 * accent hue here would read as an error state rather than as structure. The
 * caps are uniform enough to scan as a strip — the eye can run along the chord
 * band without reading the words underneath, which is exactly what a player does
 * a bar before the change.
 */

/** The chord key cap. One definition, used by every kind of chord line. */
function Chord({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-[0.25em] bg-muted px-[0.35em] py-[0.1em] font-mono text-[calc(var(--chord-scale,0.72)*1em)] leading-[1.35] font-semibold tracking-tight text-foreground tabular-nums',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SheetLines({
  source,
  className,
  style,
}: {
  source: string;
  className?: string;
  /** Carries `--chord-scale`, so chord size is a reader setting rather than a constant. */
  style?: CSSProperties;
}) {
  const lines = useMemo(() => parseChordSheet(source), [source]);

  return (
    <div style={style} className={cn('leading-relaxed', className)}>
      {lines.map((line, index) => {
        switch (line.kind) {
          case 'blank':
            // Sized in `em` so the gap between stanzas grows with the reader's
            // chosen text size instead of collapsing at 2xl.
            return <div key={index} className="h-[0.9em]" aria-hidden />;

          case 'section':
            return (
              /*
                A pill, not a line of small caps. Section markers are the thing
                a musician's eye jumps to when they lose their place mid-song,
                so they need to read as a different *kind* of thing from the
                lyrics — a shape and a colour, not merely a smaller font.

                Sized in `em` because the reader scales the whole sheet: the
                badge has to grow with the text it labels. And no `uppercase` —
                CSS maps Georgian mkhedruli onto mtavruli capitals, which is not
                how these words are written.
              */
              <h3 key={index} className="mt-6 mb-2 flex items-center gap-3 first:mt-0">
                <span className="inline-flex items-center rounded-full bg-foreground px-[0.7em] py-[0.2em] text-[0.7em] leading-normal font-semibold tracking-[0.06em] text-background">
                  {line.text}
                </span>
                {/* Runs the marker out to the margin, so a section reads as a
                    band across the sheet rather than a floating tag. */}
                <span aria-hidden className="h-px flex-1 bg-border" />
              </h3>
            );

          case 'chords':
            // A chord line with no lyric under it — an intro, a turnaround, an
            // instrumental. Column alignment carries nothing here (there is no
            // text to align to), so the tokens are set as an evenly spaced run,
            // which is far easier to read than monospace with runs of spaces.
            return (
              <div key={index} className="mb-1 flex flex-wrap items-center gap-x-[0.4em] gap-y-1">
                {line.text
                  .trim()
                  .split(/\s+/)
                  .map((chord, chordIndex) => (
                    <Chord key={chordIndex}>{chord}</Chord>
                  ))}
              </div>
            );

          case 'lyric':
            return (
              // `pre-wrap`, not `pre`: a lyric with no chords over it has no
              // alignment to protect, so there is no reason to push it off the
              // side of a phone rather than let it run onto a second line.
              <p key={index} className="whitespace-pre-wrap">
                {line.text}
              </p>
            );

          case 'pair':
            return (
              // Each column carries its chord above its own slice of the lyric,
              // so alignment holds regardless of font metrics — which is the
              // only way this works with Georgian text.
              //
              // Wrapping happens between *groups*, never between the columns
              // inside one: a chord landing mid-word splits the lyric there, and
              // an unguarded wrap would then break the word in half on a phone.
              <div key={index} className="flex flex-wrap items-end">
                {groupColumns(line.columns).map((group, groupIndex) => (
                  <span key={groupIndex} className="inline-flex items-end whitespace-nowrap">
                    {group.map((column, columnIndex) => (
                      <span key={columnIndex} className="inline-flex flex-col">
                        <span className="flex h-[1.7em] items-end">
                          {column.chord !== '' && (
                            <Chord
                              /*
                                A chord past the end of its lyric — the last beat
                                of a line, very common — has no text beneath it to
                                set the column width, so it butts straight against
                                the final word: `სიკეთეA`. It is the one place a
                                chord can be indented without lying about which
                                syllable it belongs to, because there is none.
                              */
                              className={column.text === '' ? 'ml-[0.5em]' : undefined}
                            >
                              {column.chord}
                            </Chord>
                          )}
                        </span>
                        <span className="whitespace-pre">{column.text}</span>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
