'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Account, Category, TransactionType } from '@/lib/types/database';

interface QuickAddValue {
  open: boolean;
  type: TransactionType;
  accounts: Account[];
  categories: Category[];
  openQuickAdd: (type?: TransactionType) => void;
  close: () => void;
  setOpen: (open: boolean) => void;
}

const QuickAddContext = createContext<QuickAddValue | null>(null);

export function QuickAddProvider({
  accounts,
  categories,
  children,
}: {
  accounts: Account[];
  categories: Category[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');

  const openQuickAdd = useCallback((next: TransactionType = 'expense') => {
    setType(next);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo<QuickAddValue>(
    () => ({ open, type, accounts, categories, openQuickAdd, close, setOpen }),
    [open, type, accounts, categories, openQuickAdd, close],
  );

  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}

export function useQuickAdd(): QuickAddValue {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error('useQuickAdd must be used inside <QuickAddProvider>');
  return ctx;
}
