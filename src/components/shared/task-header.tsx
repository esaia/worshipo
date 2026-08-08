import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Header for full-screen task routes (create / edit).
 *
 * An explicit back link rather than relying on the browser gesture: these pages
 * are reached from a menu, and on Android the hardware back would leave the
 * dropdown's history entry in the way.
 */
export function TaskHeader({ title, backHref }: { title: string; backHref: string }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" aria-label="უკან">
        <Link href={backHref}>
          <ChevronLeft />
        </Link>
      </Button>
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
    </div>
  );
}
