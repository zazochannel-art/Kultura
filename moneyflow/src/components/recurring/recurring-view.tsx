'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreVertical, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
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
import { IconBadge } from '@/components/shared/icon-badge';
import { PageHeader } from '@/components/shared/page-header';
import { RecurringDialog } from './recurring-dialog';
import { useI18n } from '@/lib/i18n/context';
import { formatDate, formatMoney } from '@/lib/format';
import { daysBetween, parseDateOnly, startOfDay } from '@/lib/finance/period';
import { deleteRecurring, toggleRecurring } from '@/app/(app)/recurring/actions';
import type { Account, Category, RecurringTransaction } from '@/lib/types/database';

export function RecurringView({
  entries,
  accounts,
  categories,
  monthlyTotal,
}: {
  entries: RecurringTransaction[];
  accounts: Account[];
  categories: Category[];
  monthlyTotal: number;
}) {
  const { t, lang, currency } = useI18n();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [deleting, setDeleting] = useState<RecurringTransaction | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const today = startOfDay(new Date());

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('recurring.title')}
        description={t('recurring.subtitle')}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t('recurring.add')}
          </Button>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={t('recurring.empty')}
          description={t('recurring.emptyHint')}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              {t('recurring.add')}
            </Button>
          }
        />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t('recurring.monthlyTotal')}</p>
            <p className="mf-hero-number mt-1 text-3xl font-semibold">
              {formatMoney(monthlyTotal, currency, lang)}
            </p>
          </Card>

          <div className="space-y-2">
            {entries.map((entry) => {
              const category = entry.category_id ? categoryById.get(entry.category_id) : null;
              const days = daysBetween(today, parseDateOnly(entry.next_date));

              return (
                <Card key={entry.id} className={entry.is_active ? undefined : 'opacity-60'}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <IconBadge
                      icon={category?.icon ?? 'Repeat'}
                      color={category?.color ?? '#71717A'}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t(`recurring.freq.${entry.frequency}`)} · {formatDate(entry.next_date, lang, 'short')}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p
                          className={`mf-tabular text-sm font-semibold ${entry.type === 'income' ? 'text-success' : ''}`}
                        >
                          {entry.type === 'income' ? '+' : '−'}
                          {formatMoney(Number(entry.amount), currency, lang)}
                        </p>
                        {entry.is_active ? (
                          <Badge
                            variant={days < 0 ? 'danger' : days <= 3 ? 'warning' : 'muted'}
                            className="mt-0.5 text-[10px]"
                          >
                            {days < 0
                              ? t('recurring.overdue')
                              : days === 0
                                ? t('recurring.dueToday')
                                : t('recurring.dueIn', { days })}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-0.5 text-[10px]">
                            {t('recurring.paused')}
                          </Badge>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')}>
                            <MoreVertical className="size-4 text-muted-foreground" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(entry);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" aria-hidden />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              startTransition(async () => {
                                const result = await toggleRecurring(entry.id, !entry.is_active);
                                if (result.ok) router.refresh();
                                else toast.error(t(result.error ?? 'common.somethingWrong'));
                              })
                            }
                          >
                            {entry.is_active ? (
                              <>
                                <Pause className="size-4" aria-hidden />
                                {t('recurring.paused')}
                              </>
                            ) : (
                              <>
                                <Play className="size-4" aria-hidden />
                                {t('recurring.active')}
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="danger" onSelect={() => setDeleting(entry)}>
                            <Trash2 className="size-4" aria-hidden />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <RecurringDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        accounts={accounts}
        categories={categories}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('recurring.deleteConfirm', { name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('recurring.deleteConfirmBody')}</AlertDialogDescription>
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
                  const result = await deleteRecurring(id);
                  if (result.ok) {
                    toast.success(t('recurring.deleted'));
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
