'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-danger/15 text-danger">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Ceva nu a mers</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          A apărut o problemă neașteptată. Poți încerca din nou.
        </p>
      </div>
      <Button onClick={reset}>Încearcă din nou</Button>
    </main>
  );
}
