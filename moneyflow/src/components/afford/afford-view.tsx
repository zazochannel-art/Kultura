'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Sparkles, TriangleAlert, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney, parseAmount } from '@/lib/format';
import { evaluateAfford, type AffordResult } from '@/lib/finance/afford';
import type { DailyBudgetResult } from '@/lib/finance/daily-budget';
import type { Goal } from '@/lib/types/database';
import type { TranslationKey } from '@/lib/i18n';

const VERDICT = {
  yes: {
    icon: CheckCircle2,
    label: 'afford.yes' as TranslationKey,
    body: 'afford.yes.body' as TranslationKey,
    tone: 'text-success',
    bg: 'bg-success/10',
    ring: 'border-success/40',
    dot: '🟢',
  },
  careful: {
    icon: TriangleAlert,
    label: 'afford.careful' as TranslationKey,
    body: 'afford.careful.body' as TranslationKey,
    tone: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'border-warning/40',
    dot: '🟡',
  },
  no: {
    icon: XCircle,
    label: 'afford.no' as TranslationKey,
    body: 'afford.no.body' as TranslationKey,
    tone: 'text-danger',
    bg: 'bg-danger/10',
    ring: 'border-danger/40',
    dot: '🔴',
  },
} as const;

export function AffordView({
  budget,
  savingsBalance,
  monthlySavingsTarget,
  goals,
}: {
  budget: DailyBudgetResult;
  savingsBalance: number;
  monthlySavingsTarget: number;
  goals: Goal[];
}) {
  const { t, lang, currency } = useI18n();

  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [checked, setChecked] = useState<{ label: string; result: AffordResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const money = (value: number) => formatMoney(value, currency, lang);

  const priceValue = parseAmount(price);

  const evaluate = useMemo(
    () => (value: number) =>
      evaluateAfford({
        price: value,
        budget,
        savingsBalance,
        monthlySavingsTarget,
        goals: goals.map((goal) => ({
          id: goal.id,
          name: goal.name,
          monthly_contribution: goal.monthly_contribution,
          target_amount: goal.target_amount,
          current_amount: goal.current_amount,
        })),
      }),
    [budget, savingsBalance, monthlySavingsTarget, goals],
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setError(t('afford.error.price'));
      return;
    }
    setError(null);
    setChecked({ label: label.trim() || t('afford.what'), result: evaluate(priceValue) });
  };

  const verdict = checked ? VERDICT[checked.result.verdict] : null;
  const VerdictIcon = verdict?.icon ?? Sparkles;

  return (
    <div className="space-y-4">
      <PageHeader title={t('afford.title')} description={t('afford.subtitle')} />

      <Card>
        <CardContent className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t('afford.what')} htmlFor="label">
              <Input
                id="label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t('afford.whatPlaceholder')}
                maxLength={60}
              />
            </Field>

            <Field label={t('afford.price')} htmlFor="price" error={error}>
              <MoneyInput
                id="price"
                large
                currency={currency}
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setError(null);
                }}
                placeholder="9000"
                aria-invalid={Boolean(error)}
              />
            </Field>

            <Button type="submit" size="lg" className="w-full">
              <Sparkles className="size-4" aria-hidden />
              {t('afford.check')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {checked && verdict ? (
        <Card className={cn('animate-rise border', verdict.ring)}>
          <CardContent className="space-y-4 p-5">
            <div className={cn('flex items-start gap-3 rounded-xl p-4', verdict.bg)}>
              <VerdictIcon className={cn('mt-0.5 size-6 shrink-0', verdict.tone)} aria-hidden />
              <div className="min-w-0 space-y-0.5">
                <p className={cn('text-lg font-semibold tracking-tight', verdict.tone)}>
                  {verdict.dot} {t(verdict.label)}
                </p>
                <p className="text-sm">{t(verdict.body)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">
                {checked.label} · {money(checked.result.price)}
              </p>
              <ul className="mt-2 space-y-1.5">
                {checked.result.reasons.map((reason, index) => (
                  <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                    <span aria-hidden className="text-muted-foreground/60">
                      ·
                    </span>
                    <span>{t(reason.key as TranslationKey, formatValues(reason.values, money))}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('afford.afterPurchase')}</p>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">{t('afford.remainingAfter')}</dt>
                  <dd
                    className={cn(
                      'mf-tabular text-lg font-semibold',
                      checked.result.remainingAfter < 0 && 'text-danger',
                    )}
                  >
                    {money(checked.result.remainingAfter)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t('afford.dailyAfter')}</dt>
                  <dd
                    className={cn(
                      'mf-tabular text-lg font-semibold',
                      checked.result.dailyAfter < 0 && 'text-danger',
                    )}
                  >
                    {money(checked.result.dailyAfter)}
                  </dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Reason placeholders carry raw numbers; money ones are formatted here. */
function formatValues(
  values: Record<string, number | string> | undefined,
  money: (value: number) => string,
): Record<string, string | number> | undefined {
  if (!values) return undefined;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = (key === 'daily' || key === 'amount') && typeof value === 'number' ? money(value) : value;
  }
  return out;
}
