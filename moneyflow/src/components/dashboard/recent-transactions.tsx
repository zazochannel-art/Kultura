'use client';

import Link from 'next/link';
import { ChevronRight, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { TransactionRow } from '@/components/transactions/transaction-row';
import { useT } from '@/lib/i18n/context';
import { useQuickAdd } from '@/components/layout/quick-add-context';
import type { TransactionWithRelations } from '@/lib/types/database';

export function RecentTransactions({ transactions }: { transactions: TransactionWithRelations[] }) {
  const t = useT();
  const { openQuickAdd } = useQuickAdd();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
        {transactions.length > 0 ? (
          <Link
            href="/transactions"
            className="flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('dashboard.viewAll')}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </CardHeader>

      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('tx.empty')}
            description={t('tx.emptyHint')}
            action={
              <Button size="sm" onClick={() => openQuickAdd('expense')}>
                {t('tx.add')}
              </Button>
            }
            className="border-0 py-6"
          />
        ) : (
          <div className="divide-y divide-border">
            {transactions.slice(0, 6).map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
