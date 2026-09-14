'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, MoreVertical, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { IconBadge } from '@/components/shared/icon-badge';
import { PageHeader } from '@/components/shared/page-header';
import { GoalDialog } from './goal-dialog';
import { ContributeDialog } from './contribute-dialog';
import { useI18n } from '@/lib/i18n/context';
import { formatDate, formatMoney } from '@/lib/format';
import { goalForecast } from '@/lib/finance/afford';
import { deleteGoal } from '@/app/(app)/goals/actions';
import type { Account, Goal } from '@/lib/types/database';

export function GoalsView({ goals, accounts }: { goals: Goal[]; accounts: Account[] }) {
  const { t, lang, currency } = useI18n();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [pending, startTransition] = useTransition();

  const money = (value: number) => formatMoney(value, currency, lang);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('goals.title')}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t('goals.add')}
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={t('goals.empty')}
          description={t('goals.emptyHint')}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              {t('goals.add')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {goals.map((goal) => {
            const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
            const remaining = Math.max(0, goal.target_amount - goal.current_amount);
            const forecast = goalForecast(goal);
            const reached = goal.current_amount >= goal.target_amount;

            return (
              <Card key={goal.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <IconBadge icon={goal.icon} color={goal.color} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{goal.name}</p>
                      <p className="mf-tabular text-xs text-muted-foreground">
                        {money(goal.current_amount)} / {money(goal.target_amount)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mf-tabular text-lg font-semibold" style={{ color: goal.color }}>
                        {Math.round(ratio * 100)}%
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')}>
                            <MoreVertical className="size-4 text-muted-foreground" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(goal);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" aria-hidden />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="danger" onSelect={() => setDeleting(goal)}>
                            <Trash2 className="size-4" aria-hidden />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <Progress value={ratio * 100} indicatorStyle={{ backgroundColor: goal.color }} />

                  {reached ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {t('goals.reached')}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm">{t('goals.needMore', { amount: money(remaining) })}</p>
                      <p className="text-xs text-muted-foreground">
                        {goal.monthly_contribution > 0 && forecast.months !== null
                          ? t('goals.forecast', {
                              amount: money(goal.monthly_contribution),
                              months: forecast.months,
                            })
                          : t('goals.forecastNone')}
                      </p>
                      {goal.deadline ? (
                        <p className="text-xs text-muted-foreground">
                          {forecast.onTrack === false && forecast.requiredMonthly !== null
                            ? t('goals.behind', { amount: money(forecast.requiredMonthly) })
                            : forecast.onTrack
                              ? t('goals.onTrack')
                              : formatDate(goal.deadline, lang, 'long')}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <Button variant="soft" size="sm" className="w-full" onClick={() => setContributing(goal)}>
                    <Plus className="size-4" aria-hidden />
                    {t('goals.contribute')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goal={editing}
      />

      <ContributeDialog
        goal={contributing}
        accounts={accounts}
        onOpenChange={(open) => !open && setContributing(null)}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('goals.deleteConfirm', { name: deleting?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('goals.deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-danger text-white hover:brightness-110"
              onClick={(event) => {
                event.preventDefault();
                if (!deleting) return;
                const id = deleting.id;
                startTransition(async () => {
                  const result = await deleteGoal(id);
                  if (result.ok) {
                    toast.success(t('goals.deleted'));
                    router.refresh();
                  } else {
                    toast.error(t(result.error ?? 'common.somethingWrong'));
                  }
                  setDeleting(null);
                });
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
