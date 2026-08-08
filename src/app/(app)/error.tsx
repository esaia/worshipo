'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production the message is redacted client-side; the digest is what
    // ties this to the server log entry.
    console.error('[app]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold">რაღაც ვერ გამოვიდა</h1>
        <p className="text-sm text-muted-foreground">
          {error.digest ? `კოდი: ${error.digest}` : 'სცადეთ ხელახლა.'}
        </p>
      </div>
      <Button onClick={reset}>ხელახლა ცდა</Button>
    </div>
  );
}
