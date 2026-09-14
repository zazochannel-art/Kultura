'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { failure, success, type ActionResult } from '@/lib/actions/result';
import { addMonths, monthRange } from '@/lib/finance/period';
import type { Category, MonthlyReportData, Transaction } from '@/lib/types/database';

const schema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
});

/**
 * Builds the month's report from the transactions themselves.
 *
 * Stored rather than computed on read: a closed month does not change, and the
 * report is the record of what happened — including the comparison against the
 * month before, which would otherwise have to re-read two windows every time
 * someone opens the page.
 */
export async function generateMonthlyReport(year: number, month: number): Promise<ActionResult> {
  const session = await requireUser();
  if (!session) return failure('auth.error.session');

  const parsed = schema.safeParse({ year, month });
  if (!parsed.success) return failure('common.somethingWrong');

  const period = monthRange({ year, month });
  const previous = monthRange(addMonths({ year, month }, -1));

  const [currentRes, previousRes, categoriesRes] = await Promise.all([
    session.supabase
      .from('transactions')
      .select('type, amount, category_id')
      .gte('date', period.from)
      .lte('date', period.to),
    session.supabase
      .from('transactions')
      .select('type, amount')
      .gte('date', previous.from)
      .lte('date', previous.to),
    session.supabase.from('categories').select('id, name, color'),
  ]);

  const rows = (currentRes.data ?? []) as Pick<Transaction, 'type' | 'amount' | 'category_id'>[];
  const previousRows = (previousRes.data ?? []) as Pick<Transaction, 'type' | 'amount'>[];
  const categories = (categoriesRes.data ?? []) as Pick<Category, 'id' | 'name' | 'color'>[];
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const income = rows
    .filter((row) => row.type === 'income')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = rows
    .filter((row) => row.type === 'expense')
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const byCategory = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== 'expense') continue;
    const key = row.category_id ?? 'uncategorised';
    byCategory.set(key, (byCategory.get(key) ?? 0) + Number(row.amount));
  }

  const categoryTotals = [...byCategory.entries()]
    .map(([key, amount]) => {
      const category = key === 'uncategorised' ? null : categoryById.get(key);
      return {
        name: category?.name ?? 'Other',
        color: category?.color ?? '#71717A',
        amount: Math.round(amount * 100) / 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const previousExpenses = previousRows
    .filter((row) => row.type === 'expense')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const previousIncome = previousRows
    .filter((row) => row.type === 'income')
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const expenseDelta =
    previousExpenses > 0 ? ((expenses - previousExpenses) / previousExpenses) * 100 : null;

  const data: MonthlyReportData = {
    top_category: categoryTotals[0] ?? null,
    categories: categoryTotals.slice(0, 8),
    previous: previousRows.length > 0 ? { income: previousIncome, expenses: previousExpenses } : null,
    expense_delta_pct: expenseDelta === null ? null : Math.round(expenseDelta * 10) / 10,
    transaction_count: rows.length,
  };

  const { error } = await session.supabase.from('monthly_reports').upsert(
    {
      user_id: session.userId,
      year,
      month,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savings_rate: Math.round(savingsRate * 100) / 100,
      data,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,year,month' },
  );

  if (error) return failure('common.somethingWrong');

  revalidatePath('/reports');
  return success(undefined, 'reports.generated');
}
