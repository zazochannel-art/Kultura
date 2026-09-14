'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuickAdd } from '@/components/layout/quick-add-context';

export function AddTransactionButton({ label }: { label: string }) {
  const { openQuickAdd } = useQuickAdd();

  return (
    <Button onClick={() => openQuickAdd('expense')}>
      <Plus className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
