import { Skeleton } from '@/components/ui/skeleton';

export default function SongDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${55 + ((index * 13) % 40)}%` }} />
        ))}
      </div>
    </div>
  );
}
