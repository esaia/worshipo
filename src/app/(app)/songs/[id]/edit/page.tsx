import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TaskHeader } from '@/components/shared/task-header';
import { requireEditor } from '@/features/auth/guards';
import { SongForm } from '@/features/songs/components/song-form';
import { getSongDetail, listCategories } from '@/features/songs/services';
import { toSongFormValues } from '@/features/songs/schemas';

export const metadata: Metadata = { title: 'სიმღერის რედაქტირება', robots: { index: false } };

export default async function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEditor();

  const { id } = await params;
  const [song, categories] = await Promise.all([getSongDetail(id), listCategories()]);

  if (!song) notFound();

  return (
    <>
      <TaskHeader title="სიმღერის რედაქტირება" backHref={`/songs/${song.id}`} />
      <SongForm
        categories={categories}
        songId={song.id}
        allowPhotoImport
        defaults={toSongFormValues({
          ...song,
          categoryIds: song.categories.map((category) => category.id),
        })}
      />
    </>
  );
}
