import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AppNotification, NotificationSeverity } from '@/lib/types/database';
import type { FinancialSnapshot } from './snapshot';
import { createTranslator } from '@/lib/i18n';
import { getLanguage } from '@/lib/i18n/server';
import { formatMoney } from '@/lib/format';
import { currentMonth, daysUntilPayday, daysBetween, parseDateOnly, startOfDay, toDateOnly } from '@/lib/finance/period';

interface Draft {
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body?: string | null;
  href?: string | null;
  dedupe_key: string;
}

/**
 * Derives the notifications a snapshot implies and writes the new ones.
 *
 * There is no cron here. Everything a personal finance app has to say is a
 * function of data the user already owns, so the moment they open the app is
 * the moment it is worth saying — and `dedupe_key` is what stops that becoming
 * the same warning on every page load.
 */
export async function syncNotifications(snapshot: FinancialSnapshot): Promise<void> {
  const lang = await getLanguage(snapshot.profile.language);
  const t = createTranslator(lang);
  const currency = snapshot.profile.currency;
  const money = (value: number) => formatMoney(value, currency, lang);

  const month = currentMonth(snapshot.now);
  const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`;
  const today = toDateOnly(snapshot.now);
  const drafts: Draft[] = [];

  // Bills due within three days.
  for (const bill of snapshot.upcomingBills) {
    if (bill.type !== 'expense' || bill.daysUntil > 3) continue;
    const when =
      bill.daysUntil <= 0
        ? t('recurring.dueToday')
        : t('recurring.dueIn', { days: bill.daysUntil });
    drafts.push({
      kind: 'bill_due',
      severity: bill.daysUntil <= 1 ? 'warning' : 'info',
      title: t('notifications.billDue', { name: bill.name, when }),
      body: money(bill.amount),
      href: '/recurring',
      dedupe_key: `bill:${bill.id}`,
    });
  }

  // Category budgets at or past their limit.
  for (const line of snapshot.budgetLines) {
    if (line.status === 'over') {
      drafts.push({
        kind: 'budget_over',
        severity: 'danger',
        title: t('notifications.budgetOver', { category: line.category.name }),
        body: t('budgets.overBy', { amount: money(Math.abs(line.remaining)) }),
        href: '/budgets',
        dedupe_key: `budget_over:${line.category.id}:${monthKey}`,
      });
    } else if (line.status === 'near_limit') {
      drafts.push({
        kind: 'budget_near',
        severity: 'warning',
        title: t('notifications.budgetNear', {
          category: line.category.name,
          percent: Math.round(line.ratio * 100),
        }),
        body: t('budgets.remaining', { amount: money(line.remaining) }),
        href: '/budgets',
        dedupe_key: `budget_near:${line.category.id}:${monthKey}`,
      });
    }
  }

  // Savings target met.
  if (
    snapshot.profile.monthly_savings_target > 0 &&
    snapshot.savedThisMonth >= snapshot.profile.monthly_savings_target
  ) {
    drafts.push({
      kind: 'saved',
      severity: 'success',
      title: t('notifications.savedThisMonth', { amount: money(snapshot.savedThisMonth) }),
      href: '/goals',
      dedupe_key: `saved:${monthKey}`,
    });
  }

  // Payday inside three days.
  const untilPayday = daysUntilPayday(snapshot.profile.payday_day, snapshot.now);
  if (untilPayday > 0 && untilPayday <= 3) {
    drafts.push({
      kind: 'payday',
      severity: 'info',
      title: t('notifications.paydaySoon', { days: untilPayday }),
      dedupe_key: `payday:${monthKey}`,
    });
  }

  // Debts coming due.
  for (const debt of snapshot.debts) {
    if (!debt.due_date) continue;
    const days = daysBetween(startOfDay(snapshot.now), parseDateOnly(debt.due_date));
    if (days > 3) continue;
    const when = days <= 0 ? t('recurring.overdue') : t('recurring.dueIn', { days });
    drafts.push({
      kind: 'debt_due',
      severity: days <= 0 ? 'danger' : 'warning',
      title: t('notifications.debtDue', { person: debt.person_name, when }),
      body: money(debt.amount),
      href: '/debts',
      dedupe_key: `debt:${debt.id}:${debt.due_date}`,
    });
  }

  // Goals reached.
  for (const goal of snapshot.goals) {
    if (goal.current_amount < goal.target_amount) continue;
    drafts.push({
      kind: 'goal_reached',
      severity: 'success',
      title: t('notifications.goalReached', { name: goal.name }),
      href: '/goals',
      dedupe_key: `goal:${goal.id}`,
    });
  }

  // Today's budget blown — once per day, and only once it actually is.
  if (snapshot.dailyBudget.status === 'over') {
    drafts.push({
      kind: 'daily_over',
      severity: 'warning',
      title: t('notifications.dailyOver', { amount: money(snapshot.dailyBudget.overBy) }),
      href: '/dashboard',
      dedupe_key: `daily_over:${today}`,
    });
  }

  if (drafts.length === 0) return;

  const supabase = await createClient();
  // `ignoreDuplicates` leans on the (user_id, dedupe_key) unique index, so a
  // notification already delivered is never resurrected as unread.
  await supabase.from('notifications').upsert(
    drafts.map((draft) => ({ ...draft, user_id: snapshot.profile.user_id })),
    { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
  );
}

export async function getNotifications(limit = 20): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as AppNotification[];
}
