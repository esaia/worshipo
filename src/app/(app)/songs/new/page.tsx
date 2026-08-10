import type { Metadata } from 'next';

import { TaskHeader } from '@/components/shared/task-header';
import { requireEditor } from '@/features/auth/guards';
import { SongForm } from '@/features/songs/components/song-form';
import { listCategories } from '@/features/songs/services';

export const metadata: Metadata = { title: 'ახალი სიმღერა', robots: { index: false } };

export default async function NewSongPage() {
  await requireEditor();
  const categories = await listCategories();

  return (
    <>
      <TaskHeader title="ახალი სიმღერა" backHref="/songs" />
      <SongForm categories={categories} allowPhotoImport />
    </>
  );
}
