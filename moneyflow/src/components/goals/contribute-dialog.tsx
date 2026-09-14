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
import { useI18n } from '@/lib/i18n/context';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Account, Goal } from '@/lib/types/database';
import { addContribution } from '@/app/(app)/goals/actions';

const NONE = 'none';

export function ContributeDialog({
  goal,
  accounts,
  onOpenChange,
}: {
  goal: Goal | null;
  accounts: Account[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t, currency } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(addContribution, IDLE);
  const [accountId, setAccountId] = useState<string>(NONE);

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
    <Dialog open={Boolean(goal)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal ? `${t('goals.contribute')} · ${goal.name}` : t('goals.contribute')}</DialogTitle>
        </DialogHeader>

        {goal ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="goal_id" value={goal.id} />
            <input type="hidden" name="account_id" value={accountId === NONE ? '' : accountId} />

            <Field label={t('common.amount')} htmlFor="amount" error={state.fields?.amount && t(state.fields.amount)}>
              <MoneyInput id="amount" name="amount" large required currency={currency} placeholder="0" autoFocus />
            </Field>

            <Field label={`${t('common.account')} (${t('common.optional')})`}>
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

            <Field label={`${t('common.notes')} (${t('common.optional')})`} htmlFor="note">
              <Input id="note" name="note" maxLength={120} />
            </Field>

            <SubmitButton className="w-full" pendingLabel={t('common.saving')}>
              {t('common.save')}
            </SubmitButton>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
