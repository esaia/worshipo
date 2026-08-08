import Link from 'next/link';
import { Plus } from 'lucide-react';

/**
 * Floating action button for the one thing admins do most.
 *
 * Sits above the bottom nav (`bottom-20`) rather than replacing it, and on the
 * right where a right thumb reaches without shifting grip. It renders as a
 * plain link — Phase 4 turns the tap into a photo/manual choice sheet, which is
 * when this needs to become a client component.
 */
export function AddSongFab() {
  return (
    <Link
      href="/songs/new"
      aria-label="სიმღერის დამატება"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 md:right-auto md:bottom-8 md:left-[calc(14rem+1rem)]"
    >
      <Plus className="size-6" aria-hidden />
    </Link>
  );
}
