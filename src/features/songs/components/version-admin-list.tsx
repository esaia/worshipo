'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
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
import { deleteVersion } from '../actions';
import type { SongVersion } from '../services';

/**
 * Admin-only version management, below the sheet rather than inside the
 * version switcher.
 *
 * The switcher is what a musician uses mid-service; putting edit and delete
 * buttons in it would mean a stray tap during a song can destroy an
 * arrangement. Separating the two keeps the performance view read-only.
 *
 * Every arrangement in the switcher appears here, including the song's own —
 * which previously did not, and was therefore the only tab with no visible way
 * to edit it. Reaching it meant knowing that the `⋮` menu's "Edit song" was
 * also the edit screen for the first tab, which is not something a UI can
 * expect anyone to guess. It renders without a delete button because deleting
 * it is not a version operation: the song row *is* that arrangement, so the
 * control for it is "Delete song" in the same `⋮` menu.
 */
export function VersionAdminList({
  songId,
  songVersionName,
  versions,
}: {
  songId: string;
  /** `songs.version_name` — the name of the song's own arrangement. */
  songVersionName: string;
  versions: SongVersion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<SongVersion | null>(null);

  /*
    Nothing to manage until there is a choice to manage. A song with no extra
    versions would otherwise show a one-row list whose only control duplicates
    "Edit song" in the `⋮` menu directly above it — a section heading, a border
    and a row, to say something the page already said.

    Mirrors the switcher, which hides itself on `arrangements.length > 1` for the
    same reason. The two have to agree: a "Manage versions" list under a page
    with no visible versions reads as a bug.
  */
  if (versions.length === 0) return null;

  const onDelete = (version: SongVersion) => {
    startTransition(async () => {
      const result = await deleteVersion(version.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`„${version.version_name}“ წაიშალა`);
      setConfirming(null);
      router.refresh();
    });
  };

  return (
    <section className="space-y-2 border-t border-border pt-6">
      <h2 className="text-sm font-medium text-muted-foreground">ვერსიების მართვა</h2>

      <ul className="divide-y divide-border rounded-xl border border-border">
        <li className="flex min-h-14 items-center gap-2 py-2 pr-2 pl-4">
          <span className="min-w-0 flex-1 truncate text-sm">{songVersionName}</span>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={`${songVersionName} — რედაქტირება`}
          >
            <Link href={`/songs/${songId}/edit`}>
              <Pencil />
            </Link>
          </Button>
          {/* Holds the column the delete buttons occupy below, so the pencils
              line up rather than this one sitting alone at the edge. */}
          <span aria-hidden className="size-9" />
        </li>

        {versions.map((version) => (
          <li key={version.id} className="flex min-h-14 items-center gap-2 py-2 pr-2 pl-4">
            <span className="min-w-0 flex-1 truncate text-sm">{version.version_name}</span>
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label={`${version.version_name} — რედაქტირება`}
            >
              <Link href={`/songs/${songId}/versions/${version.id}/edit`}>
                <Pencil />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`${version.version_name} — წაშლა`}
              onClick={() => setConfirming(version)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>წავშალოთ &bdquo;{confirming?.version_name}&ldquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              წაიშლება მხოლოდ ეს ვერსია. თავად სიმღერა რჩება.
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
    </section>
  );
}
