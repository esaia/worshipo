import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TaskHeader } from '@/components/shared/task-header';
import { requireEditor } from '@/features/auth/guards';
import { VersionForm } from '@/features/songs/components/version-form';
import { toVersionFormValues } from '@/features/songs/schemas';
import { getSongDetail } from '@/features/songs/services';

export const metadata: Metadata = { title: 'ვერსიის რედაქტირება', robots: { index: false } };

export default async function EditVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requireEditor();

  const { id, versionId } = await params;
  const song = await getSongDetail(id);
  const version = song?.versions.find((candidate) => candidate.id === versionId);

  if (!song || !version) notFound();

  return (
    <>
      <TaskHeader
        title={`„${version.version_name}“-ის რედაქტირება`}
        backHref={`/songs/${song.id}`}
      />
      <VersionForm
        songId={song.id}
        versionId={version.id}
        defaults={toVersionFormValues(version)}
      />
    </>
  );
}
