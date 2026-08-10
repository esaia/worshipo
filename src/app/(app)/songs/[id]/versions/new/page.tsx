import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TaskHeader } from '@/components/shared/task-header';
import { requireEditor } from '@/features/auth/guards';
import { VersionForm } from '@/features/songs/components/version-form';
import { EMPTY_VERSION_FORM } from '@/features/songs/schemas';
import { getSongDetail } from '@/features/songs/services';

export const metadata: Metadata = { title: 'ახალი ვერსია', robots: { index: false } };

export default async function NewVersionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEditor();

  const { id } = await params;
  const song = await getSongDetail(id);
  if (!song) notFound();

  return (
    <>
      <TaskHeader title={`„${song.title}“-ის ახალი ვერსია`} backHref={`/songs/${song.id}`} />
      <VersionForm
        songId={song.id}
        // Seed from the original so an arrangement is an edit, not a retype.
        defaults={{ ...EMPTY_VERSION_FORM, lyrics_with_chords: song.lyrics_with_chords }}
      />
    </>
  );
}
