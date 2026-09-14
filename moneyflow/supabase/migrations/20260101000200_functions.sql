-- ===========================================================================
-- MONEYFLOW — reporting RPCs, recurring materialisation, account deletion
--
-- Everything here is `security invoker` unless it genuinely needs more, so the
-- caller's RLS policies still decide which rows are visible.
-- ===========================================================================

-- A recurring charge must post exactly once per due date even if two tabs race
-- to materialise it.
create unique index if not exists transactions_recurring_date_key
  on public.transactions (recurring_id, date)
  where recurring_id is not null;

-- --- analytics -------------------------------------------------------------

create or replace function public.mf_monthly_totals(p_from date, p_to date)
returns table (period date, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', t.date)::date as period,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)  as income,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.date between p_from and p_to
    and t.type <> 'transfer'
  group by 1
  order by 1;
$$;

create or replace function public.mf_category_totals(
  p_from date,
  p_to date,
  p_type public.transaction_type default 'expense'
)
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  total numeric,
  tx_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    coalesce(c.name, 'Other')   as name,
    coalesce(c.icon, 'Package') as icon,
    coalesce(c.color, '#71717A') as color,
    sum(t.amount)               as total,
    count(*)                    as tx_count
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.user_id = (select auth.uid())
    and t.date between p_from and p_to
    and t.type = p_type
  group by c.id, c.name, c.icon, c.color
  order by sum(t.amount) desc;
$$;

-- Balance on each day of a window, walked backwards from today's real total.
-- Transfers move money between the user's own accounts, so they net to zero
-- and are left out.
create or replace function public.mf_balance_series(p_from date, p_to date)
returns table (day date, balance numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  net as (
    select t.date as day,
           sum(case t.type when 'income' then t.amount
                           when 'expense' then -t.amount
                           else 0 end) as delta
    from public.transactions t
    where t.user_id = (select auth.uid())
    group by t.date
  ),
  total as (
    select coalesce(sum(a.balance), 0) as bal
    from public.accounts a
    where a.user_id = (select auth.uid())
      and a.include_in_total
      and not a.is_archived
  )
  select d.day,
         (select bal from total)
           - coalesce((select sum(n.delta) from net n where n.day > d.day), 0)
  from days d
  order by d.day;
$$;

-- --- recurring -------------------------------------------------------------

create or replace function public.mf_advance_date(
  p_date date,
  p_frequency public.recurrence_frequency
)
returns date
language sql
immutable
as $$
  select case p_frequency
    when 'daily'     then p_date + interval '1 day'
    when 'weekly'    then p_date + interval '1 week'
    when 'biweekly'  then p_date + interval '2 weeks'
    when 'monthly'   then p_date + interval '1 month'
    when 'quarterly' then p_date + interval '3 months'
    when 'yearly'    then p_date + interval '1 year'
  end::date;
$$;

-- Posts every recurring charge whose due date has arrived and moves it to the
-- next one. Idempotent: the partial unique index above absorbs a double run.
create or replace function public.mf_run_due_recurring()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.recurring_transactions%rowtype;
  posted integer := 0;
  guard integer;
  next_due date;
begin
  for r in
    select * from public.recurring_transactions
    where user_id = (select auth.uid())
      and is_active
      and next_date <= current_date
      and account_id is not null
    order by next_date
  loop
    guard := 0;
    next_due := r.next_date;

    -- A charge dormant for months catches up one period at a time; the guard
    -- stops a malformed row from spinning forever.
    while next_due <= current_date and guard < 60 loop
      exit when r.end_date is not null and next_due > r.end_date;

      begin
        insert into public.transactions
          (user_id, account_id, category_id, recurring_id, type, amount, description, date)
        values
          (r.user_id, r.account_id, r.category_id, r.id, r.type, r.amount, r.name, next_due);
        posted := posted + 1;
      exception when unique_violation then
        null; -- already posted for this date
      end;

      next_due := public.mf_advance_date(next_due, r.frequency);
      guard := guard + 1;
    end loop;

    update public.recurring_transactions
       set next_date = next_due,
           last_run_at = now(),
           is_active = case
             when end_date is not null and next_due > end_date then false
             else is_active
           end
     where id = r.id;
  end loop;

  return posted;
end;
$$;

-- --- account deletion ------------------------------------------------------
-- Removing the auth user cascades through every public table, so "delete my
-- account" really does leave nothing behind.

create or replace function public.mf_delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.mf_delete_account() from public, anon;
grant execute on function public.mf_delete_account() to authenticated;
grant execute on function public.mf_monthly_totals(date, date) to authenticated;
grant execute on function public.mf_category_totals(date, date, public.transaction_type) to authenticated;
grant execute on function public.mf_balance_series(date, date) to authenticated;
grant execute on function public.mf_run_due_recurring() to authenticated;
grant execute on function public.mf_advance_date(date, public.recurrence_frequency) to authenticated;
