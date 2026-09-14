'use client';

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            'group !bg-card !text-card-foreground !border-border !rounded-xl !shadow-2xl !text-sm',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground',
          cancelButton: '!bg-accent !text-accent-foreground',
        },
      }}
    />
  );
}
