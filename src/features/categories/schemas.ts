import { z } from 'zod';

export const categoryNameSchema = z.string().trim().min(1, 'სახელი სავალდებულოა').max(60);

export const createCategorySchema = z.object({ name: categoryNameSchema });

export const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: categoryNameSchema,
});

export const deleteCategorySchema = z.object({ id: z.string().uuid() });

/**
 * Slugs are ASCII, but category names are usually Georgian — transliterating
 * would produce something nobody recognises, so a Georgian-only name falls back
 * to a short random suffix. The slug is a stable machine handle for URLs, not
 * something a human reads.
 */
export function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (ascii) return ascii.slice(0, 40);
  return `c-${Math.random().toString(36).slice(2, 8)}`;
}
