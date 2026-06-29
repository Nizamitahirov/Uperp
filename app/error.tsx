'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-4xl font-bold text-danger">Xəta baş verdi</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Gözlənilməz xəta yarandı. Yenidən cəhd edin və ya səhifəni yeniləyin.
      </p>
      <button onClick={reset} className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Yenidən cəhd et
      </button>
    </div>
  );
}
