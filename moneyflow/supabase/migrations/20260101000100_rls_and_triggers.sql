-- ===========================================================================
-- MONEYFLOW — Row Level Security, balance bookkeeping, new-user bootstrap
-- ===========================================================================

-- --- RLS -------------------------------------------------------------------
-- One policy shape for every table: you see and touch rows whose user_id is
-- yours, nothing else. `(select auth.uid())` is wrapped so Postgres evaluates
-- it once per statement instead of once per row.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'categories', 'accounts', 'transactions', 'budgets',
    'budget_categories', 'goals', 'goal_contributions',
    'recurring_transactions', 'debts', 'notifications', 'monthly_reports'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for select using (user_id = (select auth.uid()))',
      t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update using (user_id = (select auth.uid()))'
      || ' with check (user_id = (select auth.uid()))',
      t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for delete using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end $$;

-- Nothing is reachable without going through a policy: anon and authenticated
-- get table grants, RLS decides the rows.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --- account balance bookkeeping -------------------------------------------
-- `accounts.balance` is kept current by triggers rather than recomputed on
-- read: the dashboard asks for it on every load, transactions are the only
-- thing that move it, and a sum over a year of rows to render one number is
-- work we do not need to repeat.

create or replace function public.apply_transaction_to_balances(
  p_type public.transaction_type,
  p_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_sign int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type = 'income' then
    update public.accounts set balance = balance + (p_amount * p_sign)
      where id = p_account_id;
  elsif p_type = 'expense' then
    update public.accounts set balance = balance - (p_amount * p_sign)
      where id = p_account_id;
  elsif p_type = 'transfer' then
    update public.accounts set balance = balance - (p_amount * p_sign)
      where id = p_account_id;
    update public.accounts set balance = balance + (p_amount * p_sign)
      where id = p_to_account_id;
  end if;
end;
$$;

create or replace function public.transactions_sync_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_transaction_to_balances(
      new.type, new.account_id, new.to_account_id, new.amount, 1);
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.apply_transaction_to_balances(
      old.type, old.account_id, old.to_account_id, old.amount, -1);
    perform public.apply_transaction_to_balances(
      new.type, new.account_id, new.to_account_id, new.amount, 1);
    return new;
  else
    perform public.apply_transaction_to_balances(
      old.type, old.account_id, old.to_account_id, old.amount, -1);
    return old;
  end if;
end;
$$;

drop trigger if exists transactions_balance_sync on public.transactions;
create trigger transactions_balance_sync
  after insert or update or delete on public.transactions
  for each row execute function public.transactions_sync_balance();

-- --- goal progress ---------------------------------------------------------

create or replace function public.goals_sync_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_goal uuid := coalesce(new.goal_id, old.goal_id);
  total numeric;
begin
  select coalesce(sum(amount), 0) into total
    from public.goal_contributions where goal_id = target_goal;

  update public.goals
     set current_amount = greatest(total, 0),
         -- An archived goal stays archived; everything else follows the money.
         status = (case
           when status = 'archived' then 'archived'
           when total >= target_amount then 'reached'
           else 'active'
         end)::public.goal_status
   where id = target_goal;

  return coalesce(new, old);
end;
$$;

drop trigger if exists goal_contributions_sync on public.goal_contributions;
create trigger goal_contributions_sync
  after insert or update or delete on public.goal_contributions
  for each row execute function public.goals_sync_progress();

-- --- new user bootstrap ----------------------------------------------------
-- A brand-new account is useless without somewhere to put money and something
-- to label it with, so the profile, the default categories and a Cash account
-- are created the moment the auth user is.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');

  insert into public.profiles (user_id, name)
  values (new.id, display_name)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, icon, color, kind, is_default, sort_order)
  values
    (new.id, 'Food',          'UtensilsCrossed', '#D95926', 'expense', true, 1),
    (new.id, 'Car',           'Car',             '#3987E5', 'expense', true, 2),
    (new.id, 'Housing',       'Home',            '#9085E9', 'expense', true, 3),
    (new.id, 'Bills',         'Smartphone',      '#E66767', 'expense', true, 4),
    (new.id, 'Shopping',      'ShoppingCart',    '#D55181', 'expense', true, 5),
    (new.id, 'Entertainment', 'Gamepad2',        '#C98500', 'expense', true, 6),
    (new.id, 'Travel',        'Plane',           '#199E70', 'expense', true, 7),
    (new.id, 'Health',        'Pill',            '#008300', 'expense', true, 8),
    (new.id, 'Education',     'GraduationCap',   '#0EA5E9', 'expense', true, 9),
    (new.id, 'Clothing',      'Shirt',           '#EC4899', 'expense', true, 10),
    (new.id, 'Savings',       'PiggyBank',       '#22C55E', 'both',    true, 11),
    (new.id, 'Salary',        'Wallet',          '#22C55E', 'income',  true, 12),
    (new.id, 'Other',         'Package',         '#71717A', 'both',    true, 13)
  on conflict do nothing;

  insert into public.accounts (user_id, name, type, balance, color)
  values (new.id, 'Cash', 'cash', 0, '#22C55E')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
