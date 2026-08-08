import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { getSessionProfile } from '@/features/auth/guards';
import { SongActions } from '@/features/songs/components/song-actions';
import { SongArrangements } from '@/features/songs/components/version-switcher';
import { VersionAdminList } from '@/features/songs/components/version-admin-list';
import { getSongDetail } from '@/features/songs/services';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const song = await getSongDetail(id);
  if (!song) return { title: 'სიმღერა ვერ მოიძებნა' };

  return {
    title: song.title,
    description: song.artist ? `${song.title} — ${song.artist}` : song.title,
  };
}

/** Public. The performance view: what someone reads while holding a guitar. */
export default async function SongDetailPage({ params }: Params) {
  const { id } = await params;
  const [profile, song] = await Promise.all([getSessionProfile(), getSongDetail(id)]);

  if (!song) notFound();

  return (
    <article className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h1 className="font-heading text-2xl font-semibold">{song.title}</h1>
          {song.artist && <p className="text-muted-foreground">{song.artist}</p>}
          {song.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {song.categories.map((category) => (
                <Badge key={category.id} variant="secondary" className="font-normal">
                  {category.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {profile?.role === 'admin' && <SongActions songId={song.id} title={song.title} />}
      </header>

      <SongArrangements song={song} />

      {profile?.role === 'admin' && (
        <VersionAdminList
          songId={song.id}
          songVersionName={song.version_name}
          versions={song.versions}
        />
      )}
    </article>
  );
}
