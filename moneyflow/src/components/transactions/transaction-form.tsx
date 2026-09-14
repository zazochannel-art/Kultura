'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeftRight, Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { SubmitButton } from '@/components/shared/submit-button';
import { IconBadge } from '@/components/shared/icon-badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { toDateOnly } from '@/lib/finance/period';
import type { Account, Category, TransactionType, TransactionWithRelations } from '@/lib/types/database';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import { createTransaction, updateTransaction } from '@/app/(app)/transactions/actions';

const TYPES: Array<{ value: TransactionType; icon: typeof Plus }> = [
  { value: 'expense', icon: Minus },
  { value: 'income', icon: Plus },
  { value: 'transfer', icon: ArrowLeftRight },
];

export function TransactionForm({
  accounts,
  categories,
  transaction,
  defaultType = 'expense',
  onDone,
}: {
  accounts: Account[];
  categories: Category[];
  transaction?: TransactionWithRelations;
  defaultType?: TransactionType;
  onDone?: () => void;
}) {
  const { t, currency } = useI18n();
  const router = useRouter();
  const editing = Boolean(transaction);

  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [accountId, setAccountId] = useState(transaction?.account_id ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(transaction?.to_account_id ?? '');
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '');

  const [state, action] = useActionState<ActionResult, FormData>(
    editing ? updateTransaction : createTransaction,
    IDLE,
  );

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(t(state.message));
      router.refresh();
      onDone?.();
    } else if (state.error) {
      toast.error(t(state.error));
    }
    // `state` is a fresh object per submission, so this fires once per result.
  }, [state, t, router, onDone]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.kind === 'both' || c.kind === type),
    [categories, type],
  );

  // A category that does not apply to the chosen type simply stops applying —
  // derived rather than reset, so switching type and back keeps the choice.
  const activeCategoryId = visibleCategories.some((c) => c.id === categoryId) ? categoryId : '';

  const label =
    type === 'income' ? t('tx.addIncome') : type === 'transfer' ? t('tx.addTransfer') : t('tx.addExpense');

  return (
    <form action={action} className="space-y-4">
      {editing ? <input type="hidden" name="id" value={transaction!.id} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="account_id" value={accountId} />
      <input type="hidden" name="to_account_id" value={type === 'transfer' ? toAccountId : ''} />
      <input type="hidden" name="category_id" value={type === 'transfer' ? '' : activeCategoryId} />

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-accent/60 p-1">
        {TYPES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            aria-pressed={type === value}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-all',
              type === value
                ? value === 'income'
                  ? 'bg-card text-success shadow-sm'
                  : value === 'transfer'
                    ? 'bg-card text-secondary shadow-sm'
                    : 'bg-card text-danger shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="truncate">{t(`tx.${value}`)}</span>
          </button>
        ))}
      </div>

      <Field label={t('common.amount')} htmlFor="amount" error={state.fields?.amount && t(state.fields.amount)}>
        <MoneyInput
          id="amount"
          name="amount"
          large
          required
          currency={currency}
          placeholder="0"
          defaultValue={transaction ? String(transaction.amount) : ''}
          autoFocus={!editing}
          aria-invalid={Boolean(state.fields?.amount)}
        />
      </Field>

      {type === 'transfer' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('tx.from')} error={state.fields?.account_id && t(state.fields.account_id)}>
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t('common.account')} />
          </Field>
          <Field label={t('tx.to')} error={state.fields?.to_account_id && t(state.fields.to_account_id)}>
            <AccountSelect
              accounts={accounts.filter((a) => a.id !== accountId)}
              value={toAccountId}
              onChange={setToAccountId}
              placeholder={t('common.account')}
            />
          </Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('common.category')}>
            <Select value={activeCategoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t('common.category')} />
              </SelectTrigger>
              <SelectContent>
                {visibleCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="flex items-center gap-2">
                      <IconBadge icon={category.icon} color={category.color} size="sm" className="size-6 rounded-lg" />
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('common.account')} error={state.fields?.account_id && t(state.fields.account_id)}>
            <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} placeholder={t('common.account')} />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('common.description')} htmlFor="description">
          <Input
            id="description"
            name="description"
            maxLength={120}
            defaultValue={transaction?.description ?? ''}
            placeholder={t('common.description')}
          />
        </Field>
        <Field label={t('common.date')} htmlFor="date" error={state.fields?.date && t(state.fields.date)}>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={transaction?.date ?? toDateOnly(new Date())}
            aria-invalid={Boolean(state.fields?.date)}
          />
        </Field>
      </div>

      <Field label={`${t('common.notes')} (${t('common.optional')})`} htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={500} rows={2} defaultValue={transaction?.notes ?? ''} />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel={t('common.saving')}>
        {editing ? t('common.save') : label}
      </SubmitButton>
    </form>
  );
}

function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder,
}: {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: account.color }} />
              {account.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
