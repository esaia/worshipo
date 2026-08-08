import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { parseSnippet, type SongSearchResult } from '../search';

/**
 * A search result: `SongCard` plus the matched line from the lyrics.
 *
 * The snippet is rendered from parsed segments rather than injected as HTML —
 * `ts_headline` adds its own `<mark>` tags but leaves the surrounding lyric text
 * unescaped, so treating its output as markup would put stored content into the
 * DOM verbatim. See `parseSnippet`.
 */
export function SongResultCard({ song }: { song: SongSearchResult }) {
  const snippet = parseSnippet(song.snippet);

  return (
    <li>
      <Link
        href={`/songs/${song.id}`}
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">{song.title}</p>
          {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}

          {snippet.length > 0 && (
            <p className="truncate text-sm text-muted-foreground">
              {snippet.map((segment, index) =>
                segment.match ? (
                  <mark key={index} className="rounded bg-primary/15 px-0.5 text-foreground">
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </p>
          )}

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
