import type { ReactNode } from 'react';

/**
 * The save bar for full-screen task routes.
 *
 * Fixed to the bottom on phones so it is reachable without scrolling to the end
 * of a long lyric field; `env(safe-area-inset-bottom)` keeps it clear of the
 * iPhone home indicator. `BottomNav` hides itself on `/new` and `/edit`, so
 * there is nothing underneath to collide with.
 *
 * From `md:` it drops back into normal flow — a floating bar on a desktop form
 * is just a bar in the way.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
      <div className="mx-auto flex w-full max-w-3xl gap-3">{children}</div>
    </div>
  );
}
