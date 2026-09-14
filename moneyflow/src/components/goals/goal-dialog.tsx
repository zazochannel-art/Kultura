'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { SubmitButton } from '@/components/shared/submit-button';
import { ColorPicker } from '@/components/shared/color-picker';
import { IconPicker } from '@/components/shared/icon-picker';
import { useI18n } from '@/lib/i18n/context';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Goal } from '@/lib/types/database';
import { saveGoal } from '@/app/(app)/goals/actions';

export function GoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
}) {
  const { t, currency } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(saveGoal, IDLE);

  const [icon, setIcon] = useState(goal?.icon ?? 'Target');
  const [color, setColor] = useState(goal?.color ?? '#8B5CF6');

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
          <DialogTitle>{goal ? t('goals.edit') : t('goals.add')}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />

          <Field label={t('common.name')} htmlFor="name" error={state.fields?.name && t(state.fields.name)}>
            <Input
              id="name"
              name="name"
              required
              maxLength={60}
              defaultValue={goal?.name ?? ''}
              placeholder="Golf 5"
              autoFocus
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('goals.target')}
              htmlFor="target_amount"
              error={state.fields?.target_amount && t(state.fields.target_amount)}
            >
              <MoneyInput
                id="target_amount"
                name="target_amount"
                currency={currency}
                required
                defaultValue={goal ? String(goal.target_amount) : ''}
                placeholder="20000"
              />
            </Field>

            <Field label={t('goals.monthly')} htmlFor="monthly_contribution">
              <MoneyInput
                id="monthly_contribution"
                name="monthly_contribution"
                currency={currency}
                defaultValue={goal ? String(goal.monthly_contribution) : ''}
                placeholder="1000"
              />
            </Field>
          </div>

          <Field label={`${t('goals.deadline')} (${t('common.optional')})`} htmlFor="deadline">
            <Input id="deadline" name="deadline" type="date" defaultValue={goal?.deadline ?? ''} />
          </Field>

          <Field label={t('categories.color')}>
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <Field label={t('categories.icon')}>
            <IconPicker value={icon} onChange={setIcon} color={color} />
          </Field>

          <SubmitButton className="w-full" pendingLabel={t('common.saving')}>
            {t('common.save')}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
