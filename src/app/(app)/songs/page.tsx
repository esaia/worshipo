import type { Metadata } from 'next';

import { AddSongFab } from '@/components/shared/add-song-fab';
import { PageHeader } from '@/components/shared/page-header';
import { getSessionProfile } from '@/features/auth/guards';
import { SongSearch } from '@/features/songs/components/song-search';
import { parseSearchParams, SEARCH_PAGE_SIZE } from '@/features/songs/search';
import { listCategories, searchSongs } from '@/features/songs/services';
import { canEdit } from '@/types/domain';

export const metadata: Metadata = { title: 'სიმღერები' };

/**
 * Public. The first page is rendered on the server from the URL, so a shared or
 * reloaded search link paints its results in the HTML — no spinner, and it works
 * with JavaScript still loading.
 *
 * `SongSearch` then takes over on the first interaction, re-running the same
 * `search_songs` RPC seeded with this result.
 */
export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; categories?: string | string[] }>;
}) {
  const { query, categoryIds } = parseSearchParams(await searchParams);
  const params = { query, categoryIds, limit: SEARCH_PAGE_SIZE };

  const [profile, categories, page] = await Promise.all([
    getSessionProfile(),
    listCategories(),
    searchSongs(params),
  ]);

  const editor = canEdit(profile);

  return (
    <>
      <PageHeader title="სიმღერები" />

      <SongSearch categories={categories} initialParams={params} initialPage={page} />

      {editor && <AddSongFab />}
    </>
  );
}
