import { Skeleton } from '@/components/ui/skeleton';

/**
 * Row heights match `SongCard` (`min-h-16`) so the real list does not shift the
 * page when it arrives. A skeleton with the wrong height is worse than none.
 */
export default function SongsLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-6" />
          </div>
        ))}
      </div>
    </>
  );
}
