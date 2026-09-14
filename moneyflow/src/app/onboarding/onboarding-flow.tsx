'use client';

import { useActionState, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Car, Check, Home, Plane, Plus, ShieldCheck, Smartphone, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { SubmitButton } from '@/components/shared/submit-button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { CURRENCIES, formatMoney, parseAmount } from '@/lib/format';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Category, CurrencyCode } from '@/lib/types/database';
import { completeOnboarding } from './actions';

interface FixedExpense {
  key: string;
  name: string;
  amount: string;
  categoryId: string | null;
}

interface GoalDraft {
  key: string;
  name: string;
  target: string;
  icon: string;
  color: string;
  selected: boolean;
}

const TOTAL_STEPS = 4;

const SUGGESTED_FIXED = [
  { name: 'Chirie', icon: Home, category: 'housing' },
  { name: 'Internet', icon: Smartphone, category: 'bills' },
  { name: 'Telefon', icon: Smartphone, category: 'bills' },
  { name: 'Abonamente', icon: Wallet, category: 'entertainment' },
];

const SUGGESTED_GOALS: Array<Omit<GoalDraft, 'key' | 'selected'>> = [
  { name: 'Mașină', target: '20000', icon: 'Car', color: '#06B6D4' },
  { name: 'Vacanță', target: '10000', icon: 'Plane', color: '#8B5CF6' },
  { name: 'Telefon', target: '8000', icon: 'Smartphone', color: '#EC4899' },
  { name: 'Locuință', target: '100000', icon: 'Home', color: '#F59E0B' },
  { name: 'Fond de urgență', target: '45000', icon: 'ShieldCheck', color: '#22C55E' },
];

const GOAL_ICONS: Record<string, typeof Car> = {
  Car,
  Plane,
  Smartphone,
  Home,
  ShieldCheck,
};

let keySeed = 0;
const nextKey = () => `k${(keySeed += 1)}`;

export function OnboardingFlow({ categories }: { categories: Category[] }) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(1);

  const [currency, setCurrency] = useState<CurrencyCode>('MDL');
  const [income, setIncome] = useState('');
  const [paydayDay, setPaydayDay] = useState('5');
  const [savings, setSavings] = useState('');
  const [emergency, setEmergency] = useState('');
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [goals, setGoals] = useState<GoalDraft[]>(
    SUGGESTED_GOALS.map((goal) => ({ ...goal, key: nextKey(), selected: false })),
  );

  const [state, action] = useActionState<ActionResult, FormData>(completeOnboarding, IDLE);

  const categoryByName = useMemo(
    () => new Map(categories.map((c) => [c.name.toLowerCase(), c.id])),
    [categories],
  );

  const incomeValue = parseAmount(income) || 0;
  const fixedTotal = fixed.reduce((sum, item) => sum + (parseAmount(item.amount) || 0), 0);
  const suggestedSavings = Math.max(0, Math.round(incomeValue * 0.2));

  const payload = JSON.stringify({
    currency,
    income: incomeValue,
    paydayDay: Number(paydayDay) || 1,
    savingsTarget: parseAmount(savings) || 0,
    emergencyTarget: parseAmount(emergency) || 0,
    fixedExpenses: fixed
      .filter((item) => item.name.trim() && (parseAmount(item.amount) || 0) > 0)
      .map((item) => ({
        name: item.name.trim(),
        amount: parseAmount(item.amount),
        categoryId: item.categoryId,
      })),
    goals: goals
      .filter((goal) => goal.selected && goal.name.trim() && (parseAmount(goal.target) || 0) > 0)
      .map((goal) => ({
        name: goal.name.trim(),
        target: parseAmount(goal.target),
        icon: goal.icon,
        color: goal.color,
      })),
  });

  const canContinue = step === 1 ? incomeValue > 0 : true;

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('onboarding.step', { current: step, total: TOTAL_STEPS })}</span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i < step ? 'bg-primary' : 'bg-accent',
              )}
            />
          ))}
        </div>
      </div>

      <Card className="animate-rise">
        <CardContent className="space-y-5 p-5">
          {step === 1 ? (
            <>
              <Header title={t('onboarding.step1.title')} subtitle={t('onboarding.step1.subtitle')} />

              <Field label={t('onboarding.step1.label')} htmlFor="income">
                <MoneyInput
                  id="income"
                  large
                  currency={currency}
                  value={income}
                  onChange={(event) => setIncome(event.target.value)}
                  placeholder="15000"
                  autoFocus
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('onboarding.currency')}>
                  <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code} · {t(`currency.${code}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={t('onboarding.step1.payday')} htmlFor="payday">
                  <Input
                    id="payday"
                    type="number"
                    min={1}
                    max={31}
                    value={paydayDay}
                    onChange={(event) => setPaydayDay(event.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Header title={t('onboarding.step2.title')} subtitle={t('onboarding.step2.subtitle')} />

              <div className="flex flex-wrap gap-2">
                {SUGGESTED_FIXED.map((suggestion) => (
                  <Button
                    key={suggestion.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFixed((prev) => [
                        ...prev,
                        {
                          key: nextKey(),
                          name: suggestion.name,
                          amount: '',
                          categoryId: categoryByName.get(suggestion.category) ?? null,
                        },
                      ])
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {suggestion.name}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                {fixed.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    {t('onboarding.step2.empty')}
                  </p>
                ) : (
                  fixed.map((item, index) => (
                    <div key={item.key} className="flex items-center gap-2">
                      <Input
                        value={item.name}
                        onChange={(event) =>
                          setFixed((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)),
                          )
                        }
                        placeholder={t('onboarding.step2.name')}
                        className="flex-1"
                      />
                      <div className="w-32 shrink-0">
                        <MoneyInput
                          currency={currency}
                          value={item.amount}
                          onChange={(event) =>
                            setFixed((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, amount: event.target.value } : row)),
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('common.delete')}
                        onClick={() => setFixed((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4 text-muted-foreground" aria-hidden />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() =>
                  setFixed((prev) => [...prev, { key: nextKey(), name: '', amount: '', categoryId: null }])
                }
              >
                <Plus className="size-4" aria-hidden />
                {t('onboarding.step2.add')}
              </Button>

              {fixedTotal > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('onboarding.step2.total', { amount: formatMoney(fixedTotal, currency, lang) })}
                </p>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Header title={t('onboarding.step3.title')} subtitle={t('onboarding.step3.subtitle')} />

              <Field
                label={t('onboarding.step3.label')}
                htmlFor="savings"
                hint={
                  suggestedSavings > 0
                    ? t('onboarding.step3.suggestion', {
                        amount: formatMoney(suggestedSavings, currency, lang),
                      })
                    : undefined
                }
              >
                <MoneyInput
                  id="savings"
                  large
                  currency={currency}
                  value={savings}
                  onChange={(event) => setSavings(event.target.value)}
                  placeholder={String(suggestedSavings || 2000)}
                  autoFocus
                />
              </Field>

              {suggestedSavings > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSavings(String(suggestedSavings))}
                >
                  {formatMoney(suggestedSavings, currency, lang)}
                </Button>
              ) : null}

              <Field label={t('onboarding.step3.emergency')} htmlFor="emergency">
                <MoneyInput
                  id="emergency"
                  currency={currency}
                  value={emergency}
                  onChange={(event) => setEmergency(event.target.value)}
                  placeholder={String(Math.round(incomeValue * 3) || 45000)}
                />
              </Field>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Header title={t('onboarding.step4.title')} subtitle={t('onboarding.step4.subtitle')} />

              <div className="space-y-2">
                {goals.map((goal, index) => {
                  const Icon = GOAL_ICONS[goal.icon] ?? Wallet;
                  return (
                    <div
                      key={goal.key}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                        goal.selected ? 'border-primary/60 bg-primary/5' : 'border-border',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setGoals((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, selected: !row.selected } : row)),
                          )
                        }
                        aria-pressed={goal.selected}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
                        >
                          <Icon className="size-4.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{goal.name}</span>
                      </button>

                      {goal.selected ? (
                        <div className="w-32 shrink-0">
                          <MoneyInput
                            currency={currency}
                            value={goal.target}
                            onChange={(event) =>
                              setGoals((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, target: event.target.value } : row)),
                              )
                            }
                            aria-label={t('onboarding.step4.target')}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatMoney(parseAmount(goal.target) || 0, currency, lang)}
                        </span>
                      )}

                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                          goal.selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                        )}
                        aria-hidden
                      >
                        {goal.selected ? <Check className="size-3" /> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {state.error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {t(state.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" aria-hidden />
            {t('common.back')}
          </Button>
        ) : null}

        <div className="flex-1" />

        {step < TOTAL_STEPS ? (
          <Button type="button" size="lg" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            {t('common.next')}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <form action={action}>
            <input type="hidden" name="payload" value={payload} />
            <SubmitButton size="lg" pendingLabel={t('common.saving')}>
              {t('onboarding.finish')}
              <ArrowRight className="size-4" aria-hidden />
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
