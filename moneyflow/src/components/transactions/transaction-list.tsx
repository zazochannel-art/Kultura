'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Receipt, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { TransactionForm } from './transaction-form';
import { TransactionRow } from './transaction-row';
import { useI18n } from '@/lib/i18n/context';
import { useQuickAdd } from '@/components/layout/quick-add-context';
import { formatDate } from '@/lib/format';
import { deleteTransaction } from '@/app/(app)/transactions/actions';
import type { Account, Category, TransactionWithRelations } from '@/lib/types/database';

export function TransactionList({
  transactions,
  accounts,
  categories,
  filtered,
}: {
  transactions: TransactionWithRelations[];
  accounts: Account[];
  categories: Category[];
  filtered: boolean;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { openQuickAdd } = useQuickAdd();

  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [deleting, setDeleting] = useState<TransactionWithRelations | null>(null);
  const [pending, startTransition] = useTransition();

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title={filtered ? t('tx.noResults') : t('tx.empty')}
        description={filtered ? undefined : t('tx.emptyHint')}
        action={
          filtered ? undefined : (
            <Button size="sm" onClick={() => openQuickAdd('expense')}>
              {t('tx.add')}
            </Button>
          )
        }
      />
    );
  }

  // Grouped by day: a flat list of 200 rows is a spreadsheet, not a statement.
  const groups = new Map<string, TransactionWithRelations[]>();
  for (const transaction of transactions) {
    const list = groups.get(transaction.date) ?? [];
    list.push(transaction);
    groups.set(transaction.date, list);
  }

  const confirmDelete = () => {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.ok) {
        toast.success(t('tx.deleted'));
        router.refresh();
      } else {
        toast.error(t(result.error ?? 'common.somethingWrong'));
      }
      setDeleting(null);
    });
  };

  return (
    <>
      <div className="space-y-4">
        {[...groups.entries()].map(([date, rows]) => (
          <div key={date} className="space-y-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              {formatDate(date, lang, 'medium')}
            </p>
            <Card>
              <CardContent className="divide-y divide-border px-3 py-1">
                {rows.map((transaction) => (
                  <div key={transaction.id} className="group flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <TransactionRow
                        transaction={transaction}
                        showDate={false}
                        onClick={() => setEditing(transaction)}
                      />
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('common.edit')}
                        onClick={() => setEditing(transaction)}
                      >
                        <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('common.delete')}
                        onClick={() => setDeleting(transaction)}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.edit')}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <TransactionForm
              key={editing.id}
              accounts={accounts}
              categories={categories}
              transaction={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tx.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('tx.deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={pending}
              className="bg-danger text-white hover:brightness-110"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
