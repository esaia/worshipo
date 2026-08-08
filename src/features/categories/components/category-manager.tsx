'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CategoryWithCount } from '@/features/songs/services';
import { createCategory, deleteCategory, renameCategory } from '../actions';

/**
 * Inline editing rather than a separate edit route.
 *
 * Categories are one short field; a full page per rename would be three
 * navigations to fix a typo. Songs get their own routes because they are long
 * forms — the asymmetry is intentional.
 */
export function CategoryManager({ categories }: { categories: CategoryWithCount[] }) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirming, setConfirming] = useState<CategoryWithCount | null>(null);

  const onCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;

    startTransition(async () => {
      const result = await createCategory({ name: newName });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewName('');
      toast.success('კატეგორია დაემატა');
    });
  };

  const onRename = (id: string) => {
    startTransition(async () => {
      const result = await renameCategory({ id, name: editingName });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      toast.success('სახელი შეიცვალა');
    });
  };

  const onDelete = (category: CategoryWithCount) => {
    startTransition(async () => {
      const result = await deleteCategory({ id: category.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`„${category.name}“ წაიშალა`);
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="flex gap-2">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="ახალი კატეგორია"
          aria-label="ახალი კატეგორიის სახელი"
          maxLength={60}
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || !newName.trim()}
          aria-label="კატეგორიის დამატება"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        </Button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {categories.map((category) => (
          <li key={category.id} className="flex min-h-16 items-center gap-2 py-2 pr-2 pl-4">
            {editingId === category.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  aria-label={`${category.name} — სახელის შეცვლა`}
                  autoFocus
                  maxLength={60}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onRename(category.id);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onRename(category.id)}
                  aria-label="სახელის შენახვა"
                >
                  <Check />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  aria-label="გაუქმება"
                >
                  <X />
                </Button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{category.name}</p>
                  <p className="text-sm text-muted-foreground">{category.songCount} სიმღერა</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${category.name} — სახელის შეცვლა`}
                  onClick={() => {
                    setEditingId(category.id);
                    setEditingName(category.name);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${category.name} — წაშლა`}
                  onClick={() => setConfirming(category)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>წავშალოთ &bdquo;{confirming?.name}&ldquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.songCount
                ? `მოიხსნება ${confirming.songCount} სიმღერიდან. თავად სიმღერები არ იშლება.`
                : 'ამ კატეგორიას არცერთი სიმღერა არ იყენებს.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>გაუქმება</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirming && onDelete(confirming)}>
              წაშლა
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
