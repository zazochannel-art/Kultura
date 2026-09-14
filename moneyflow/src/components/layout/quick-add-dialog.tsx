'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { useQuickAdd } from './quick-add-context';
import { useT } from '@/lib/i18n/context';

export function QuickAddDialog() {
  const { open, setOpen, close, type, accounts, categories } = useQuickAdd();
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('quickAdd.title')}</DialogTitle>
        </DialogHeader>
        {/* Remounting on each open resets the form rather than showing the last entry. */}
        {open ? (
          <TransactionForm
            key={type}
            accounts={accounts}
            categories={categories}
            defaultType={type}
            onDone={close}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
