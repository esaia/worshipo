'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/features/auth/guards';
import { stripChords } from '@/lib/chords/strip';
import { createClient } from '@/lib/supabase/server';
import { actionError, actionOk, type ActionResult } from '@/types/domain';
import { songInputSchema, uuidSchema, versionInputSchema } from './schemas';

/**
 * Writes go through the *user's* client, not the admin client. RLS enforces
 * admin-only writes at the database, so `requireAdmin()` here is a fast,
 * friendly failure rather than the only thing standing between a member and
 * the catalogue.
 *
 * Ids are separate arguments rather than form fields: they are not user input,
 * they come from the route, and keeping them out of the schema means the form
 * types describe only what the form actually renders.
 */

const DUPLICATE = '23505';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Category membership is rewritten wholesale rather than diffed.
 *
 * Delete-then-insert is not atomic with the song write, so a failure between
 * the two leaves a song with no categories. That is deliberate: the failure is
 * reported, harmless, and fixed by re-saving. Making it atomic means a stored
 * procedure per mutation — a lot of machinery to protect a join table with two
 * columns.
 */
async function setSongCategories(
  supabase: SupabaseClient,
  songId: string,
  categoryIds: string[],
): Promise<string | null> {
  const { error: deleteError } = await supabase
    .from('song_categories')
    .delete()
    .eq('song_id', songId);
  if (deleteError) return deleteError.message;

  if (categoryIds.length === 0) return null;

  const { error: insertError } = await supabase
    .from('song_categories')
    .insert(categoryIds.map((categoryId) => ({ song_id: songId, category_id: categoryId })));

  return insertError?.message ?? null;
}

function revalidateSong(id?: string) {
  revalidatePath('/songs');
  revalidatePath('/');
  if (id) revalidatePath(`/songs/${id}`);
}

// -----------------------------------------------------------------------------
// Songs
// -----------------------------------------------------------------------------

export async function createSong(input: unknown): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

  const parsed = songInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const { categoryIds, ...song } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('songs')
    .insert({
      ...song,
      // Derived, never entered by hand: this is what search indexes.
      lyrics_plain: stripChords(song.lyrics_with_chords),
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (error || !data) return actionError(error?.message ?? 'სიმღერის შენახვა ვერ მოხერხდა');

  const categoryError = await setSongCategories(supabase, data.id, categoryIds);
  if (categoryError) return actionError(`სიმღერა შეინახა, კატეგორიები კი ვერ: ${categoryError}`);

  revalidateSong(data.id);
  return actionOk({ id: data.id });
}

export async function updateSong(
  songId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const id = uuidSchema.safeParse(songId);
  if (!id.success) return actionError('არასწორი სიმღერა');

  const parsed = songInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const { categoryIds, ...song } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('songs')
    .update({ ...song, lyrics_plain: stripChords(song.lyrics_with_chords) })
    .eq('id', id.data);

  if (error) return actionError(error.message);

  const categoryError = await setSongCategories(supabase, id.data, categoryIds);
  if (categoryError) return actionError(`სიმღერა შეინახა, კატეგორიები კი ვერ: ${categoryError}`);

  revalidateSong(id.data);
  return actionOk({ id: id.data });
}

export async function deleteSong(songId: string): Promise<ActionResult> {
  await requireAdmin();

  const id = uuidSchema.safeParse(songId);
  if (!id.success) return actionError('არასწორი სიმღერა');

  const supabase = await createClient();
  // Versions and category links cascade via their foreign keys.
  const { error } = await supabase.from('songs').delete().eq('id', id.data);
  if (error) return actionError(error.message);

  revalidateSong(id.data);
  return actionOk();
}

// -----------------------------------------------------------------------------
// Versions
// -----------------------------------------------------------------------------

/** The (song_id, version_name) unique index is the likeliest failure here. */
function versionError(code: string | undefined, fallback: string) {
  return code === DUPLICATE ? 'ამ სიმღერას ასეთი სახელის ვერსია უკვე აქვს' : fallback;
}

export async function createVersion(
  songId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();

  const id = uuidSchema.safeParse(songId);
  if (!id.success) return actionError('არასწორი სიმღერა');

  const parsed = versionInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('song_versions')
    .insert({
      ...parsed.data,
      song_id: id.data,
      lyrics_plain: stripChords(parsed.data.lyrics_with_chords),
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return actionError(versionError(error?.code, error?.message ?? 'ვერსიის შენახვა ვერ მოხერხდა'));
  }

  revalidateSong(id.data);
  return actionOk({ id: data.id });
}

export async function updateVersion(
  versionId: string,
  songId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const id = uuidSchema.safeParse(versionId);
  const song = uuidSchema.safeParse(songId);
  if (!id.success || !song.success) return actionError('არასწორი ვერსია');

  const parsed = versionInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('song_versions')
    .update({ ...parsed.data, lyrics_plain: stripChords(parsed.data.lyrics_with_chords) })
    .eq('id', id.data);

  if (error) return actionError(versionError(error.code, error.message));

  revalidateSong(song.data);
  return actionOk({ id: id.data });
}

export async function deleteVersion(versionId: string): Promise<ActionResult> {
  await requireAdmin();

  const id = uuidSchema.safeParse(versionId);
  if (!id.success) return actionError('არასწორი ვერსია');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('song_versions')
    .delete()
    .eq('id', id.data)
    .select('song_id')
    .single();

  if (error) return actionError(error.message);

  revalidateSong(data?.song_id);
  return actionOk();
}
