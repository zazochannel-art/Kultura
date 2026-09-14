/**
 * Database types, kept in step with supabase/migrations by hand.
 *
 * `supabase gen types typescript` can regenerate this file once the project is
 * linked (see README); it is written out here so the app type-checks against a
 * schema even before anyone has provisioned a database.
 */

export type AccountType = 'cash' | 'bank' | 'card' | 'savings';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'expense' | 'both';
export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';
export type DebtDirection = 'i_owe' | 'owed_to_me';
export type DebtStatus = 'open' | 'paid';
export type GoalStatus = 'active' | 'reached' | 'archived';
export type CurrencyCode = 'MDL' | 'EUR' | 'USD' | 'RON';
export type LanguageCode = 'ro' | 'ru' | 'en';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  currency: CurrencyCode;
  language: LanguageCode;
  theme: string;
  monthly_income: number;
  monthly_savings_target: number;
  emergency_fund_target: number;
  payday_day: number;
  onboarding_completed: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: CurrencyCode;
  color: string;
  include_in_total: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  goal_id: string | null;
  recurring_id: string | null;
  type: TransactionType;
  amount: number;
  description: string | null;
  notes: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithRelations extends Transaction {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
  to_account: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
}

export interface Budget {
  id: string;
  user_id: string;
  year: number;
  month: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  user_id: string;
  budget_id: string;
  category_id: string;
  amount: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  deadline: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  user_id: string;
  goal_id: string;
  account_id: string | null;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  type: Exclude<TransactionType, 'transfer'>;
  frequency: RecurrenceFrequency;
  next_date: string;
  end_date: string | null;
  category_id: string | null;
  account_id: string | null;
  is_active: boolean;
  is_fixed: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  person_name: string;
  amount: number;
  direction: DebtDirection;
  due_date: string | null;
  status: DebtStatus;
  note: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  href: string | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}

export interface MonthlyReport {
  id: string;
  user_id: string;
  year: number;
  month: number;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
  data: MonthlyReportData;
  generated_at: string;
}

export interface MonthlyReportData {
  top_category?: { name: string; amount: number; color: string } | null;
  categories?: Array<{ name: string; amount: number; color: string }>;
  previous?: { income: number; expenses: number } | null;
  expense_delta_pct?: number | null;
  transaction_count?: number;
}

/** Row shapes returned by the reporting RPCs. */
export interface MonthlyTotalsRow {
  period: string;
  income: number;
  expense: number;
}

export interface CategoryTotalsRow {
  category_id: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
  tx_count: number;
}

export interface BalanceSeriesRow {
  day: string;
  balance: number;
}
