'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuickAdd } from './quick-add-context';
import type { TransactionType } from '@/lib/types/database';

const TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

/**
 * Opens the quick-add sheet from `?add=expense`, which is how the installed
 * app's home-screen shortcuts get straight to the form.
 */
export function QuickAddLauncher() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { openQuickAdd } = useQuickAdd();
  const handled = useRef(false);

  useEffect(() => {
    const requested = params.get('add');
    if (!requested || handled.current) return;
    if (!TYPES.includes(requested as TransactionType)) return;

    handled.current = true;
    openQuickAdd(requested as TransactionType);

    // Drop the param so a refresh does not reopen the sheet.
    const next = new URLSearchParams(params.toString());
    next.delete('add');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, openQuickAdd, router, pathname]);

  return null;
}
