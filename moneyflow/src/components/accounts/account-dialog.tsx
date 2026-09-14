'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { SubmitButton } from '@/components/shared/submit-button';
import { ColorPicker } from '@/components/shared/color-picker';
import { useI18n } from '@/lib/i18n/context';
import { CURRENCIES } from '@/lib/format';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Account, AccountType, CurrencyCode } from '@/lib/types/database';
import { saveAccount } from '@/app/(app)/accounts/actions';

const TYPES: AccountType[] = ['cash', 'bank', 'card', 'savings'];

export function AccountDialog({
  open,
  onOpenChange,
  account,
  defaultCurrency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  defaultCurrency: CurrencyCode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(saveAccount, IDLE);

  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency ?? defaultCurrency);
  const [color, setColor] = useState(account?.color ?? '#06B6D4');
  const [includeInTotal, setIncludeInTotal] = useState(account?.include_in_total ?? true);

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
          <DialogTitle>{account ? t('accounts.edit') : t('accounts.add')}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {account ? <input type="hidden" name="id" value={account.id} /> : null}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="include_in_total" value={includeInTotal ? 'on' : ''} />

          <Field label={t('accounts.name')} htmlFor="name" error={state.fields?.name && t(state.fields.name)}>
            <Input
              id="name"
              name="name"
              required
              maxLength={40}
              defaultValue={account?.name ?? ''}
              placeholder="Victoriabank"
              autoFocus
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('common.type')}>
              <Select value={type} onValueChange={(value) => setType(value as AccountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`accounts.type.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('settings.currency')}>
              <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label={account ? t('accounts.balance') : t('accounts.openingBalance')}
            htmlFor="balance"
          >
            <MoneyInput
              id="balance"
              name="balance"
              currency={currency}
              defaultValue={account ? String(account.balance) : ''}
              placeholder="0"
            />
          </Field>

          <Field label={t('categories.color')}>
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
            <Label htmlFor="include" className="text-sm font-normal">
              {t('accounts.includeInTotal')}
            </Label>
            <Switch id="include" checked={includeInTotal} onCheckedChange={setIncludeInTotal} />
          </div>

          <SubmitButton className="w-full" pendingLabel={t('common.saving')}>
            {t('common.save')}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
