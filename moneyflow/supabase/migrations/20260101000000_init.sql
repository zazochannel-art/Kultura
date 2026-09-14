-- ===========================================================================
-- MONEYFLOW — core schema
--
-- Every table is owned by exactly one auth user and protected by Row Level
-- Security keyed on `user_id`. There is no shared data and no service-role
-- path in the app: a user can only ever see their own rows.
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- enums -----------------------------------------------------------------

do $$ begin
  create type public.account_type as enum ('cash', 'bank', 'card', 'savings');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_kind as enum ('income', 'expense', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recurrence_frequency as enum
    ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.debt_direction as enum ('i_owe', 'owed_to_me');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.debt_status as enum ('open', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_status as enum ('active', 'reached', 'archived');
exception when duplicate_object then null; end $$;

-- --- shared helpers --------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --- profiles --------------------------------------------------------------

create table if not exists public.profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  name                   text,
  currency               text not null default 'MDL',
  language               text not null default 'ro',
  theme                  text not null default 'dark',
  monthly_income         numeric(14, 2) not null default 0,
  monthly_savings_target numeric(14, 2) not null default 0,
  emergency_fund_target  numeric(14, 2) not null default 0,
  payday_day             smallint not null default 1,
  onboarding_completed   boolean not null default false,
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint profiles_currency_check check (currency in ('MDL', 'EUR', 'USD', 'RON')),
  constraint profiles_language_check check (language in ('ro', 'ru', 'en')),
  constraint profiles_payday_check check (payday_day between 1 and 31),
  constraint profiles_income_check check (monthly_income >= 0),
  constraint profiles_savings_check check (monthly_savings_target >= 0)
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- --- categories ------------------------------------------------------------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text not null default 'Circle',
  color      text not null default '#71717A',
  kind       public.category_kind not null default 'expense',
  is_default boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_name_check check (char_length(trim(name)) between 1 and 40),
  constraint categories_color_check check (color ~* '^#[0-9a-f]{6}$')
);

create unique index if not exists categories_user_name_key
  on public.categories (user_id, lower(name));
create index if not exists categories_user_idx on public.categories (user_id);

-- --- accounts --------------------------------------------------------------

create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  type             public.account_type not null default 'cash',
  balance          numeric(14, 2) not null default 0,
  currency         text not null default 'MDL',
  color            text not null default '#06B6D4',
  include_in_total boolean not null default true,
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint accounts_name_check check (char_length(trim(name)) between 1 and 40),
  constraint accounts_currency_check check (currency in ('MDL', 'EUR', 'USD', 'RON'))
);

create index if not exists accounts_user_idx on public.accounts (user_id, is_archived);

drop trigger if exists accounts_touch on public.accounts;
create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();

-- --- goals -----------------------------------------------------------------

create table if not exists public.goals (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  icon                 text not null default 'Target',
  color                text not null default '#8B5CF6',
  target_amount        numeric(14, 2) not null,
  current_amount       numeric(14, 2) not null default 0,
  monthly_contribution numeric(14, 2) not null default 0,
  deadline             date,
  status               public.goal_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint goals_name_check check (char_length(trim(name)) between 1 and 60),
  constraint goals_target_check check (target_amount > 0),
  constraint goals_current_check check (current_amount >= 0),
  constraint goals_contribution_check check (monthly_contribution >= 0)
);

create index if not exists goals_user_idx on public.goals (user_id, status);

drop trigger if exists goals_touch on public.goals;
create trigger goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();

-- --- recurring transactions ------------------------------------------------

create table if not exists public.recurring_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(14, 2) not null,
  type        public.transaction_type not null default 'expense',
  frequency   public.recurrence_frequency not null default 'monthly',
  next_date   date not null,
  end_date    date,
  category_id uuid references public.categories(id) on delete set null,
  account_id  uuid references public.accounts(id) on delete set null,
  is_active   boolean not null default true,
  is_fixed    boolean not null default true,
  last_run_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint recurring_name_check check (char_length(trim(name)) between 1 and 60),
  constraint recurring_amount_check check (amount > 0),
  constraint recurring_type_check check (type in ('income', 'expense'))
);

create index if not exists recurring_user_idx
  on public.recurring_transactions (user_id, is_active, next_date);

drop trigger if exists recurring_touch on public.recurring_transactions;
create trigger recurring_touch before update on public.recurring_transactions
  for each row execute function public.touch_updated_at();

-- --- transactions ----------------------------------------------------------

create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete cascade,
  to_account_id  uuid references public.accounts(id) on delete cascade,
  category_id    uuid references public.categories(id) on delete set null,
  goal_id        uuid references public.goals(id) on delete set null,
  recurring_id   uuid references public.recurring_transactions(id) on delete set null,
  type           public.transaction_type not null,
  amount         numeric(14, 2) not null,
  description    text,
  notes          text,
  date           date not null default current_date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint transactions_amount_check check (amount > 0),
  -- A transfer needs a destination and must not point at its own source; the
  -- other two types must not carry one at all.
  constraint transactions_transfer_check check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null)
  )
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id, date desc);
create index if not exists transactions_account_idx on public.transactions (account_id);
create index if not exists transactions_to_account_idx on public.transactions (to_account_id);
create index if not exists transactions_goal_idx on public.transactions (goal_id);

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- --- budgets ---------------------------------------------------------------

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  year       smallint not null,
  month      smallint not null,
  amount     numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_month_check check (month between 1 and 12),
  constraint budgets_year_check check (year between 2000 and 2200),
  constraint budgets_amount_check check (amount >= 0),
  constraint budgets_unique_period unique (user_id, year, month)
);

drop trigger if exists budgets_touch on public.budgets;
create trigger budgets_touch before update on public.budgets
  for each row execute function public.touch_updated_at();

create table if not exists public.budget_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  budget_id   uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount      numeric(14, 2) not null default 0,
  created_at  timestamptz not null default now(),
  constraint budget_categories_amount_check check (amount >= 0),
  constraint budget_categories_unique unique (budget_id, category_id)
);

create index if not exists budget_categories_user_idx
  on public.budget_categories (user_id, budget_id);

-- --- goal contributions ----------------------------------------------------

create table if not exists public.goal_contributions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  goal_id    uuid not null references public.goals(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  amount     numeric(14, 2) not null,
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now(),
  constraint goal_contributions_amount_check check (amount <> 0)
);

create index if not exists goal_contributions_goal_idx
  on public.goal_contributions (user_id, goal_id, date desc);

-- --- debts -----------------------------------------------------------------

create table if not exists public.debts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  person_name text not null,
  amount      numeric(14, 2) not null,
  direction   public.debt_direction not null,
  due_date    date,
  status      public.debt_status not null default 'open',
  note        text,
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint debts_person_check check (char_length(trim(person_name)) between 1 and 60),
  constraint debts_amount_check check (amount > 0)
);

create index if not exists debts_user_idx on public.debts (user_id, status, due_date);

drop trigger if exists debts_touch on public.debts;
create trigger debts_touch before update on public.debts
  for each row execute function public.touch_updated_at();

-- --- notifications ---------------------------------------------------------

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  severity    text not null default 'info',
  title       text not null,
  body        text,
  href        text,
  dedupe_key  text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint notifications_severity_check
    check (severity in ('info', 'success', 'warning', 'danger')),
  constraint notifications_dedupe_unique unique (user_id, dedupe_key)
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);

-- --- monthly reports -------------------------------------------------------

create table if not exists public.monthly_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  year         smallint not null,
  month        smallint not null,
  income       numeric(14, 2) not null default 0,
  expenses     numeric(14, 2) not null default 0,
  savings      numeric(14, 2) not null default 0,
  savings_rate numeric(6, 2) not null default 0,
  data         jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  constraint monthly_reports_month_check check (month between 1 and 12),
  constraint monthly_reports_unique unique (user_id, year, month)
);

create index if not exists monthly_reports_user_idx
  on public.monthly_reports (user_id, year desc, month desc);
