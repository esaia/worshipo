'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Category } from '@/types/domain';

/**
 * Toggle chips rather than a multi-select dropdown.
 *
 * With ~10 categories the whole set fits on screen, so a dropdown would add a
 * tap and hide the current selection behind it. Chips show state and change it
 * in one touch.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  };

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">კატეგორიები ჯერ არ არის.</p>;
  }

  return (
    <div role="group" aria-label="კატეგორიები" className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const selected = value.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category.id)}
            aria-pressed={selected}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground',
            )}
          >
            {selected && <Check className="size-3.5" aria-hidden />}
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
