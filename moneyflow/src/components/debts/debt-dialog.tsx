'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { SubmitButton } from '@/components/shared/submit-button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Debt, DebtDirection } from '@/lib/types/database';
import { saveDebt } from '@/app/(app)/debts/actions';

export function DebtDialog({
  open,
  onOpenChange,
  debt,
  defaultDirection = 'i_owe',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt | null;
  defaultDirection?: DebtDirection;
}) {
  const { t, currency } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(saveDebt, IDLE);
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? defaultDirection);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(t(state.message));
      router.refresh();
      onOpenChange(false);
    } else if (state.error) {
      toast.error(t(state.error));
    }
  }, [state, t, router, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{debt ? t('debts.edit') : t('debts.add')}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {debt ? <input type="hidden" name="id" value={debt.id} /> : null}
          <input type="hidden" name="direction" value={direction} />

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-accent/60 p-1">
            {(['i_owe', 'owed_to_me'] as DebtDirection[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                aria-pressed={direction === value}
                className={cn(
                  'rounded-lg px-2 py-2 text-sm font-medium transition-all',
                  direction === value
                    ? value === 'i_owe'
                      ? 'bg-card text-danger shadow-sm'
                      : 'bg-card text-success shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {value === 'i_owe' ? t('debts.iOwe') : t('debts.owedToMe')}
              </button>
            ))}
          </div>

          <Field
            label={t('debts.person')}
            htmlFor="person_name"
            error={state.fields?.person_name && t(state.fields.person_name)}
          >
            <Input
              id="person_name"
              name="person_name"
              required
              maxLength={60}
              defaultValue={debt?.person_name ?? ''}
              placeholder="Ion"
              autoFocus
            />
          </Field>

          <Field label={t('common.amount')} htmlFor="amount" error={state.fields?.amount && t(state.fields.amount)}>
            <MoneyInput
              id="amount"
              name="amount"
              required
              currency={currency}
              defaultValue={debt ? String(debt.amount) : ''}
              placeholder="500"
            />
          </Field>

          <Field label={`${t('debts.dueDate')} (${t('common.optional')})`} htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" defaultValue={debt?.due_date ?? ''} />
          </Field>

          <Field label={`${t('common.notes')} (${t('common.optional')})`} htmlFor="note">
            <Input id="note" name="note" maxLength={200} defaultValue={debt?.note ?? ''} />
          </Field>

          <SubmitButton className="w-full" pendingLabel={t('common.saving')}>
            {t('common.save')}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
