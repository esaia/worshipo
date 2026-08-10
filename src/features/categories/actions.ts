'use server';

import { revalidatePath } from 'next/cache';

import { requireEditor } from '@/features/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { actionError, actionOk, type ActionResult } from '@/types/domain';
import {
  createCategorySchema,
  deleteCategorySchema,
  slugify,
  updateCategorySchema,
} from './schemas';

const DUPLICATE = '23505';

function revalidateCategories() {
  revalidatePath('/categories');
  revalidatePath('/songs');
  revalidatePath('/');
}

export async function createCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireEditor();

  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: parsed.data.name, slug: slugify(parsed.data.name) })
    .select('id')
    .single();

  if (error || !data) {
    return actionError(
      error?.code === DUPLICATE
        ? 'ამ სახელით კატეგორია უკვე არსებობს'
        : (error?.message ?? 'კატეგორიის შექმნა ვერ მოხერხდა'),
    );
  }

  revalidateCategories();
  return actionOk({ id: data.id });
}

/**
 * Renames only. The slug stays put on purpose: it is the stable handle a
 * bookmarked filter URL depends on, and a rename is usually a typo fix rather
 * than a change of meaning.
 */
export async function renameCategory(input: unknown): Promise<ActionResult> {
  await requireEditor();

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id);

  if (error) {
    return actionError(
      error.code === DUPLICATE ? 'ამ სახელით კატეგორია უკვე არსებობს' : error.message,
    );
  }

  revalidateCategories();
  return actionOk();
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  await requireEditor();

  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) return actionError('არასწორი მოთხოვნა');

  const supabase = await createClient();
  // song_categories rows cascade; the songs themselves are untouched.
  const { error } = await supabase.from('categories').delete().eq('id', parsed.data.id);
  if (error) return actionError(error.message);

  revalidateCategories();
  return actionOk();
}
