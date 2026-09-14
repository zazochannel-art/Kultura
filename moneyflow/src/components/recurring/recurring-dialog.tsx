'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { SubmitButton } from '@/components/shared/submit-button';
import { IconBadge } from '@/components/shared/icon-badge';
import { useI18n } from '@/lib/i18n/context';
import { toDateOnly } from '@/lib/finance/period';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Account, Category, RecurrenceFrequency, RecurringTransaction } from '@/lib/types/database';
import { saveRecurring } from '@/app/(app)/recurring/actions';

const FREQUENCIES: RecurrenceFrequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
];

const NONE = 'none';

export function RecurringDialog({
  open,
  onOpenChange,
  entry,
  accounts,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: RecurringTransaction | null;
  accounts: Account[];
  categories: Category[];
}) {
  const { t, currency } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(saveRecurring, IDLE);

  const [type, setType] = useState<'income' | 'expense'>(entry?.type ?? 'expense');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(entry?.frequency ?? 'monthly');
  const [categoryId, setCategoryId] = useState(entry?.category_id ?? NONE);
  const [accountId, setAccountId] = useState(entry?.account_id ?? accounts[0]?.id ?? NONE);

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? t('recurring.edit') : t('recurring.add')}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="frequency" value={frequency} />
          <input type="hidden" name="category_id" value={categoryId === NONE ? '' : categoryId} />
          <input type="hidden" name="account_id" value={accountId === NONE ? '' : accountId} />

          <Field label={t('common.name')} htmlFor="name" error={state.fields?.name && t(state.fields.name)}>
            <Input
              id="name"
              name="name"
              required
              maxLength={60}
              defaultValue={entry?.name ?? ''}
              placeholder="Netflix"
              autoFocus
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common.amount')} htmlFor="amount" error={state.fields?.amount && t(state.fields.amount)}>
              <MoneyInput
                id="amount"
                name="amount"
                required
                currency={currency}
                defaultValue={entry ? String(entry.amount) : ''}
                placeholder="150"
              />
            </Field>

            <Field label={t('common.type')}>
              <Select value={type} onValueChange={(value) => setType(value as 'income' | 'expense')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{t('tx.expense')}</SelectItem>
                  <SelectItem value="income">{t('tx.income')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('recurring.frequency')}>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as RecurrenceFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`recurring.freq.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t('recurring.nextDate')}
              htmlFor="next_date"
              error={state.fields?.next_date && t(state.fields.next_date)}
            >
              <Input
                id="next_date"
                name="next_date"
                type="date"
                required
                defaultValue={entry?.next_date ?? toDateOnly(new Date())}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common.category')}>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                  {categories
                    .filter((category) => category.kind === 'both' || category.kind === type)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <span className="flex items-center gap-2">
                          <IconBadge
                            icon={category.icon}
                            color={category.color}
                            size="sm"
                            className="size-6 rounded-lg"
                          />
                          {category.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('common.account')}>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={`${t('recurring.endDate')} (${t('common.optional')})`} htmlFor="end_date">
            <Input id="end_date" name="end_date" type="date" defaultValue={entry?.end_date ?? ''} />
          </Field>

          <SubmitButton className="w-full" pendingLabel={t('common.saving')}>
            {t('common.save')}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
