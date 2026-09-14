'use client';

import { ArrowLeftRight } from 'lucide-react';
import { IconBadge } from '@/components/shared/icon-badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney, formatRelativeDay } from '@/lib/format';
import type { TransactionWithRelations } from '@/lib/types/database';

export function TransactionRow({
  transaction,
  onClick,
  showDate = true,
}: {
  transaction: TransactionWithRelations;
  onClick?: () => void;
  showDate?: boolean;
}) {
  const { t, lang, currency } = useI18n();

  const isTransfer = transaction.type === 'transfer';
  const isIncome = transaction.type === 'income';

  const title =
    transaction.description ||
    (isTransfer
      ? `${transaction.account?.name ?? '—'} → ${transaction.to_account?.name ?? '—'}`
      : (transaction.category?.name ?? t('common.none')));

  const subtitle = [
    showDate
      ? formatRelativeDay(transaction.date, lang, {
          today: t('common.today'),
          yesterday: t('common.yesterday'),
        })
      : null,
    isTransfer ? t('tx.transfer') : transaction.account?.name,
    !isTransfer && transaction.description ? transaction.category?.name : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const amount = formatMoney(transaction.amount, currency, lang);

  const content = (
    <>
      {isTransfer ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
          <ArrowLeftRight className="size-5" aria-hidden />
        </span>
      ) : (
        <IconBadge
          icon={transaction.category?.icon ?? 'Package'}
          color={transaction.category?.color ?? '#71717A'}
        />
      )}

      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>

      <span
        className={cn(
          'mf-tabular shrink-0 text-sm font-medium',
          isIncome ? 'text-success' : isTransfer ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {isIncome ? '+' : isTransfer ? '' : '−'}
        {amount}
      </span>
    </>
  );

  if (!onClick) {
    return <div className="flex items-center gap-3 py-2">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg py-2 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {content}
    </button>
  );
}
