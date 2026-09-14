'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, HandCoins, MoreVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { DebtDialog } from './debt-dialog';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { formatDate, formatMoney, initials } from '@/lib/format';
import { daysBetween, parseDateOnly, startOfDay } from '@/lib/finance/period';
import { deleteDebt, setDebtStatus } from '@/app/(app)/debts/actions';
import type { Debt, DebtDirection } from '@/lib/types/database';

export function DebtsView({ debts }: { debts: Debt[] }) {
  const { t, lang, currency } = useI18n();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [direction, setDirection] = useState<DebtDirection>('i_owe');
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [pending, startTransition] = useTransition();

  const open = debts.filter((debt) => debt.status === 'open');
  const iOwe = open.filter((debt) => debt.direction === 'i_owe');
  const owedToMe = open.filter((debt) => debt.direction === 'owed_to_me');
  const paid = debts.filter((debt) => debt.status === 'paid');

  const totalOwe = iOwe.reduce((sum, debt) => sum + Number(debt.amount), 0);
  const totalOwed = owedToMe.reduce((sum, debt) => sum + Number(debt.amount), 0);
  const net = totalOwed - totalOwe;

  const money = (value: number) => formatMoney(value, currency, lang);

  const openDialog = (next: DebtDirection) => {
    setEditing(null);
    setDirection(next);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('debts.title')}
        action={
          <Button onClick={() => openDialog('i_owe')}>
            <Plus className="size-4" aria-hidden />
            {t('debts.add')}
          </Button>
        }
      />

      {debts.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={t('debts.empty')}
          description={t('debts.emptyHint')}
          action={
            <Button size="sm" onClick={() => openDialog('i_owe')}>
              {t('debts.add')}
            </Button>
          }
        />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t('debts.netPosition')}</p>
            <p
              className={cn(
                'mf-hero-number mt-1 text-3xl font-semibold',
                net > 0 ? 'text-success' : net < 0 ? 'text-danger' : undefined,
              )}
            >
              {net > 0 ? '+' : ''}
              {money(net)}
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-muted-foreground">
                {t('debts.iOwe')}: <span className="mf-tabular text-danger">{money(totalOwe)}</span>
              </span>
              <span className="text-muted-foreground">
                {t('debts.owedToMe')}: <span className="mf-tabular text-success">{money(totalOwed)}</span>
              </span>
            </div>
          </Card>

          <Section title={t('debts.iOwe')} tone="danger" debts={iOwe} onAdd={() => openDialog('i_owe')}>
            {(debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onEdit={() => {
                  setEditing(debt);
                  setDialogOpen(true);
                }}
                onToggle={() =>
                  startTransition(async () => {
                    const result = await setDebtStatus(debt.id, debt.status === 'open');
                    if (result.ok) router.refresh();
                    else toast.error(t(result.error ?? 'common.somethingWrong'));
                  })
                }
                onDelete={() => setDeleting(debt)}
              />
            )}
          </Section>

          <Section
            title={t('debts.owedToMe')}
            tone="success"
            debts={owedToMe}
            onAdd={() => openDialog('owed_to_me')}
          >
            {(debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                onEdit={() => {
                  setEditing(debt);
                  setDialogOpen(true);
                }}
                onToggle={() =>
                  startTransition(async () => {
                    const result = await setDebtStatus(debt.id, debt.status === 'open');
                    if (result.ok) router.refresh();
                    else toast.error(t(result.error ?? 'common.somethingWrong'));
                  })
                }
                onDelete={() => setDeleting(debt)}
              />
            )}
          </Section>

          {paid.length > 0 ? (
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">{t('debts.paid')}</h2>
              <div className="space-y-2">
                {paid.map((debt) => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    dimmed
                    onEdit={() => {
                      setEditing(debt);
                      setDialogOpen(true);
                    }}
                    onToggle={() =>
                      startTransition(async () => {
                        const result = await setDebtStatus(debt.id, false);
                        if (result.ok) router.refresh();
                        else toast.error(t(result.error ?? 'common.somethingWrong'));
                      })
                    }
                    onDelete={() => setDeleting(debt)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <DebtDialog
        key={editing?.id ?? direction}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        debt={editing}
        defaultDirection={direction}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(value) => !value && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('debts.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('debts.deleteConfirmBody')}</AlertDialogDescription>
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
                  const result = await deleteDebt(id);
                  if (result.ok) {
                    toast.success(t('debts.deleted'));
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

function Section({
  title,
  tone,
  debts,
  onAdd,
  children,
}: {
  title: string;
  tone: 'danger' | 'success';
  debts: Debt[];
  onAdd: () => void;
  children: (debt: Debt) => React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className={cn('text-sm font-medium', tone === 'danger' ? 'text-danger' : 'text-success')}>
          {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" aria-hidden />
          {t('common.add')}
        </Button>
      </div>

      {debts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          {t('debts.empty')}
        </p>
      ) : (
        <div className="space-y-2">{debts.map(children)}</div>
      )}
    </section>
  );
}

function DebtCard({
  debt,
  dimmed,
  onEdit,
  onToggle,
  onDelete,
}: {
  debt: Debt;
  dimmed?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t, lang, currency } = useI18n();
  const overdue =
    debt.status === 'open' &&
    debt.due_date &&
    daysBetween(startOfDay(new Date()), parseDateOnly(debt.due_date)) < 0;

  return (
    <Card className={dimmed ? 'opacity-60' : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xs font-semibold">
          {initials(debt.person_name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{debt.person_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {debt.note ? `${debt.note} · ` : ''}
            {debt.due_date ? formatDate(debt.due_date, lang, 'short') : t('common.none')}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p
              className={cn(
                'mf-tabular text-sm font-semibold',
                debt.direction === 'i_owe' ? 'text-danger' : 'text-success',
              )}
            >
              {formatMoney(Number(debt.amount), currency, lang)}
            </p>
            {overdue ? (
              <Badge variant="danger" className="mt-0.5 text-[10px]">
                {t('debts.overdue', {
                  days: Math.abs(daysBetween(startOfDay(new Date()), parseDateOnly(debt.due_date!))),
                })}
              </Badge>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')}>
                <MoreVertical className="size-4 text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onToggle}>
                {debt.status === 'open' ? (
                  <>
                    <Check className="size-4" aria-hidden />
                    {t('debts.markPaid')}
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" aria-hidden />
                    {t('debts.markOpen')}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4" aria-hidden />
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="danger" onSelect={onDelete}>
                <Trash2 className="size-4" aria-hidden />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
