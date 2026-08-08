'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { ChordSheet } from './chord-sheet';
import type { SongDetail } from '../services';

type Arrangement = {
  id: string;
  name: string;
  lyrics: string;
  notes: string | null;
  key: string | null;
  capo: number | null;
};

/**
 * The song row itself is the default arrangement, so a song with zero versions
 * is already complete — there is no empty "original" version to bootstrap.
 *
 * Its name comes from `songs.version_name` (migration 0006) rather than a
 * literal here. It used to be the hard-coded string "Original", which made the
 * one arrangement every song has the only one nobody could rename.
 *
 * A version's null key/capo means "inherit from the song", which is resolved
 * here rather than in the database so the fallback is visible in one place.
 */
function toArrangements(song: SongDetail): Arrangement[] {
  return [
    {
      id: 'original',
      name: song.version_name,
      lyrics: song.lyrics_with_chords,
      notes: song.notes,
      key: song.key,
      capo: song.capo,
    },
    ...song.versions.map((version) => ({
      id: version.id,
      name: version.version_name,
      lyrics: version.lyrics_with_chords,
      notes: version.notes,
      key: version.key ?? song.key,
      capo: version.capo ?? song.capo,
    })),
  ];
}

export function SongArrangements({ song }: { song: SongDetail }) {
  const arrangements = toArrangements(song);
  const [selectedId, setSelectedId] = useState(arrangements[0]?.id ?? 'original');
  const current = arrangements.find((a) => a.id === selectedId) ?? arrangements[0];

  if (!current) return null;

  return (
    <div className="space-y-4">
      {arrangements.length > 1 && (
        // Segmented control, horizontally scrollable rather than wrapping:
        // wrapping would shift the sheet down as versions are added.
        <div
          role="tablist"
          aria-label="ვერსიები"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1"
        >
          {arrangements.map((arrangement) => (
            <button
              key={arrangement.id}
              type="button"
              role="tab"
              aria-selected={arrangement.id === selectedId}
              onClick={() => setSelectedId(arrangement.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                arrangement.id === selectedId
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {arrangement.name}
            </button>
          ))}
        </div>
      )}

      {(current.key || current.capo) && (
        <p className="flex gap-4 text-sm text-muted-foreground">
          {current.key && (
            <span>
              ტონალობა <span className="font-mono text-foreground">{current.key}</span>
            </span>
          )}
          {current.capo !== null && current.capo > 0 && (
            <span>
              კაპო <span className="font-mono text-foreground">{current.capo}</span>
            </span>
          )}
        </p>
      )}

      <ChordSheet source={current.lyrics} />

      {current.notes && (
        <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm whitespace-pre-wrap">
          {current.notes}
        </div>
      )}
    </div>
  );
}
