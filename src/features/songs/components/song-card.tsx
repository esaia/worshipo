import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type { SongListItem } from '../services';

/**
 * Server Component — the songbook list ships no JavaScript for its main content.
 *
 * `min-h-16` and full-row link: the whole card is the tap target, not the title.
 */
export function SongCard({ song }: { song: SongListItem }) {
  return (
    <li>
      <Link
        href={`/songs/${song.id}`}
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">{song.title}</p>
          {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
          {song.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {song.categories.slice(0, 3).map((category) => (
                <Badge key={category.id} variant="secondary" className="text-xs font-normal">
                  {category.name}
                </Badge>
              ))}
              {song.categories.length > 3 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  +{song.categories.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {song.key && (
          <span className="shrink-0 font-mono text-sm text-muted-foreground">{song.key}</span>
        )}
      </Link>
    </li>
  );
}
