'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/lib/i18n/context';
import type { Account, Category } from '@/lib/types/database';

const ALL = 'all';

/**
 * Filters live in the URL: a filtered view is shareable, survives a refresh,
 * and the back button does what it looks like it does.
 */
export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
      next.delete('page');
      router.replace(`/transactions?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const type = params.get('type') ?? ALL;
  const categoryId = params.get('category') ?? ALL;
  const accountId = params.get('account') ?? ALL;
  const search = params.get('q') ?? '';
  const hasFilters = [type, categoryId, accountId].some((v) => v !== ALL) || search !== '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        defaultValue={search}
        placeholder={t('common.search')}
        className="h-9 w-full sm:w-48"
        onChange={(event) => {
          const value = event.target.value;
          // Debounce through the URL rather than local state, so a reload keeps it.
          window.clearTimeout((window as unknown as { __mfSearch?: number }).__mfSearch);
          (window as unknown as { __mfSearch?: number }).__mfSearch = window.setTimeout(
            () => setParam('q', value),
            300,
          );
        }}
      />

      <Select value={type} onValueChange={(value) => setParam('type', value)}>
        <SelectTrigger className="h-9 w-auto min-w-28">
          <SelectValue placeholder={t('tx.filterType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.all')}</SelectItem>
          <SelectItem value="expense">{t('tx.expense')}</SelectItem>
          <SelectItem value="income">{t('tx.income')}</SelectItem>
          <SelectItem value="transfer">{t('tx.transfer')}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={categoryId} onValueChange={(value) => setParam('category', value)}>
        <SelectTrigger className="h-9 w-auto min-w-32">
          <SelectValue placeholder={t('tx.filterCategory')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.all')}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={accountId} onValueChange={(value) => setParam('account', value)}>
        <SelectTrigger className="h-9 w-auto min-w-32">
          <SelectValue placeholder={t('tx.filterAccount')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.all')}</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/transactions')}>
          <X className="size-3.5" aria-hidden />
          {t('common.all')}
        </Button>
      ) : null}
    </div>
  );
}
