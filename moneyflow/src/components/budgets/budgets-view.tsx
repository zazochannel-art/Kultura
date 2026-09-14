'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { IconBadge } from '@/components/shared/icon-badge';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { SubmitButton } from '@/components/shared/submit-button';
import { EmptyState } from '@/components/shared/empty-state';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney, formatMonthName, parseAmount } from '@/lib/format';
import { addMonths } from '@/lib/finance/period';
import { IDLE } from '@/lib/actions/result';
import type { Category, CurrencyCode } from '@/lib/types/database';
import { copyPreviousBudget, saveBudget } from '@/app/(app)/budgets/actions';

export interface BudgetRow {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
  planned: number;
  spent: number;
}

const STATUS = {
  safe: { badge: 'success', bar: 'bg-success', key: 'budgets.safe' },
  near_limit: { badge: 'warning', bar: 'bg-warning', key: 'budgets.nearLimit' },
  over: { badge: 'danger', bar: 'bg-danger', key: 'budgets.over' },
} as const;

export function BudgetsView({
  year,
  month,
  rows,
  currency,
}: {
  year: number;
  month: number;
  rows: BudgetRow[];
  currency: CurrencyCode;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.category.id, row.planned > 0 ? String(row.planned) : ''])),
  );
  const [pending, startTransition] = useTransition();

  /**
   * The action is awaited here rather than routed through `useActionState`:
   * saving a budget has to close the editor, and reacting to a result inside an
   * effect would mean mirroring server state into React state one render late.
   */
  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveBudget(IDLE, formData);
      if (result.ok) {
        toast.success(t(result.message ?? 'budgets.saved'));
        setEditing(false);
        router.refresh();
      } else {
        toast.error(t(result.error ?? 'common.somethingWrong'));
      }
    });
  };

  const active = useMemo(() => rows.filter((row) => row.planned > 0), [rows]);
  const totalPlanned = active.reduce((sum, row) => sum + row.planned, 0);
  const totalSpent = active.reduce((sum, row) => sum + row.spent, 0);

  const payload = JSON.stringify({
    year,
    month,
    lines: rows.map((row) => ({
      categoryId: row.category.id,
      amount: Math.max(0, parseAmount(drafts[row.category.id] ?? '') || 0),
    })),
  });

  const previous = addMonths({ year, month }, -1);
  const next = addMonths({ year, month }, 1);
  const money = (value: number) => formatMoney(value, currency, lang);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('budgets.title')}
        description={t('budgets.subtitle')}
        action={
          editing ? null : (
            <Button onClick={() => setEditing(true)}>{active.length > 0 ? t('common.edit') : t('common.add')}</Button>
          )
        }
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.back')}
          onClick={() => router.push(`/budgets?month=${previous.year}-${String(previous.month).padStart(2, '0')}`)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="text-sm font-medium">{formatMonthName(year, month, lang)}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.next')}
          onClick={() => router.push(`/budgets?month=${next.year}-${String(next.month).padStart(2, '0')}`)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      {editing ? (
        <form action={submit} className="space-y-3">
          <input type="hidden" name="payload" value={payload} />

          <Card>
            <CardContent className="space-y-3 p-4">
              {rows.map((row) => (
                <div key={row.category.id} className="flex items-center gap-3">
                  <IconBadge icon={row.category.icon} color={row.category.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{row.category.name}</span>
                  <div className="w-32 shrink-0">
                    <MoneyInput
                      currency={currency}
                      value={drafts[row.category.id] ?? ''}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [row.category.id]: event.target.value }))
                      }
                      placeholder="0"
                      aria-label={row.category.name}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <SubmitButton className="flex-1" pendingLabel={t('common.saving')} disabled={pending}>
              {t('common.save')}
            </SubmitButton>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : active.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={PiggyBank}
            title={t('budgets.empty')}
            description={t('budgets.emptyHint')}
            action={<Button size="sm" onClick={() => setEditing(true)}>{t('common.add')}</Button>}
          />
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await copyPreviousBudget(year, month);
                  if (result.ok) {
                    toast.success(t(result.message ?? 'budgets.copied'));
                    router.refresh();
                  } else {
                    toast.error(t(result.error ?? 'common.somethingWrong'));
                  }
                })
              }
            >
              <Copy className="size-4" aria-hidden />
              {t('budgets.copyPrevious')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('budgets.totalSpent')}</p>
                <p className="mf-hero-number mt-1 text-3xl font-semibold">{money(totalSpent)}</p>
              </div>
              <p className="mf-tabular text-sm text-muted-foreground">
                {t('common.of')} {money(totalPlanned)}
              </p>
            </div>
            <Progress
              value={totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0}
              className="mt-4"
              indicatorClassName={
                totalSpent > totalPlanned ? 'bg-danger' : totalSpent / totalPlanned >= 0.8 ? 'bg-warning' : 'bg-success'
              }
            />
          </Card>

          <div className="space-y-2">
            {active.map((row) => {
              const ratio = row.planned > 0 ? row.spent / row.planned : 0;
              const status = ratio > 1 ? 'over' : ratio >= 0.8 ? 'near_limit' : 'safe';
              const tone = STATUS[status];

              return (
                <Card key={row.category.id}>
                  <CardContent className="space-y-2.5 p-4">
                    <div className="flex items-center gap-3">
                      <IconBadge icon={row.category.icon} color={row.category.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.category.name}</p>
                        <p className="mf-tabular text-xs text-muted-foreground">
                          {money(row.spent)} / {money(row.planned)}
                        </p>
                      </div>
                      <Badge variant={tone.badge} className="shrink-0">
                        {t(tone.key)}
                      </Badge>
                    </div>

                    <Progress value={ratio * 100} indicatorClassName={tone.bar} />

                    <p className="text-xs text-muted-foreground">
                      {row.spent > row.planned
                        ? t('budgets.overBy', { amount: money(row.spent - row.planned) })
                        : t('budgets.remaining', { amount: money(row.planned - row.spent) })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
