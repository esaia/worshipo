import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { requireAdmin } from '@/features/auth/guards';
import { CategoryManager } from '@/features/categories/components/category-manager';
import { listCategoriesWithCounts } from '@/features/songs/services';

export const metadata: Metadata = { title: 'კატეგორიები', robots: { index: false } };

export default async function CategoriesPage() {
  await requireAdmin();
  const categories = await listCategoriesWithCounts();

  return (
    <>
      <PageHeader title="კატეგორიები" description="ერთი სიმღერა შეიძლება რამდენიმეს ეკუთვნოდეს." />
      <CategoryManager categories={categories} />
    </>
  );
}
