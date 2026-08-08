'use client';

import Link from 'next/link';
import { CopyPlus, ExternalLink } from 'lucide-react';

import { useDuplicateCheck } from '../hooks/use-duplicate-check';

/**
 * "This might already be in the songbook."
 *
 * Advisory, never blocking. The save button stays enabled the whole time and
 * there is no "are you sure" — a false positive that stops work is worse than
 * the duplicate it was trying to prevent, and near-identical titles are normal
 * in a worship songbook.
 *
 * Each match offers the two things the admin actually wants at that moment:
 * open what already exists, or add this arrangement to it as a version. Doing
 * neither and carrying on typing is the third option, and it needs no button.
 */
export function DuplicateWarning({ title }: { title: string }) {
  const matches = useDuplicateCheck(title);

  if (matches.length === 0) return null;

  return (
    <div
      role="status"
      className="space-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
    >
      <p className="text-xs font-medium text-muted-foreground">
        {matches.length === 1 ? 'მსგავსი სიმღერა უკვე არსებობს' : 'მსგავსი სიმღერები უკვე არსებობს'}
      </p>

      <ul className="space-y-1.5">
        {matches.map((song) => (
          <li key={song.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">
              {song.title}
              {song.artist && <span className="text-muted-foreground"> · {song.artist}</span>}
              {song.version_count > 0 && (
                <span className="text-muted-foreground"> · {song.version_count} ვერსია</span>
              )}
            </span>

            <Link
              href={`/songs/${song.id}`}
              aria-label={`${song.title} — გახსნა`}
              title="გახსნა"
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </Link>
            <Link
              href={`/songs/${song.id}/versions/new`}
              aria-label={`${song.title} — ვერსიის დამატება`}
              title="ამ სიმღერას ვერსიის დამატება"
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CopyPlus className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
