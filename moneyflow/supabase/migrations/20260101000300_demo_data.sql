-- ===========================================================================
-- MONEYFLOW — demo data
--
-- Demo data is never a separate "demo user": it is written into the calling
-- user's own account and the profile is flagged `is_demo`, so it lives behind
-- the same RLS as everything else and `mf_clear_demo_data()` takes it all back
-- out again. Nothing here runs unless someone asks for it.
-- ===========================================================================

create or replace function public.mf_clear_demo_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.goal_contributions where user_id = uid;
  delete from public.transactions where user_id = uid;
  delete from public.budget_categories where user_id = uid;
  delete from public.budgets where user_id = uid;
  delete from public.goals where user_id = uid;
  delete from public.recurring_transactions where user_id = uid;
  delete from public.debts where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.monthly_reports where user_id = uid;
  delete from public.accounts where user_id = uid;

  update public.profiles
     set is_demo = false,
         monthly_income = 0,
         monthly_savings_target = 0,
         emergency_fund_target = 0,
         onboarding_completed = false
   where user_id = uid;
end;
$$;

create or replace function public.mf_seed_demo_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acc_cash uuid;
  acc_vb uuid;
  acc_maib uuid;
  acc_save uuid;
  cat record;
  cat_food uuid;
  cat_car uuid;
  cat_house uuid;
  cat_bills uuid;
  cat_shop uuid;
  cat_fun uuid;
  cat_salary uuid;
  goal_car uuid;
  goal_trip uuid;
  goal_fund uuid;
  budget_id uuid;
  d date;
  m int;
  salary_day date;
  pick int;
  amt numeric;
  target_cat uuid;
  target_acc uuid;
  label text;
  seed_start date := (date_trunc('month', current_date) - interval '3 months')::date;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  perform public.mf_clear_demo_data();

  -- Categories already exist from the new-user bootstrap; make sure of it.
  if not exists (select 1 from public.categories where user_id = uid) then
    insert into public.categories (user_id, name, icon, color, kind, is_default, sort_order)
    values
      (uid, 'Food', 'UtensilsCrossed', '#D95926', 'expense', true, 1),
      (uid, 'Car', 'Car', '#3987E5', 'expense', true, 2),
      (uid, 'Housing', 'Home', '#9085E9', 'expense', true, 3),
      (uid, 'Bills', 'Smartphone', '#E66767', 'expense', true, 4),
      (uid, 'Shopping', 'ShoppingCart', '#D55181', 'expense', true, 5),
      (uid, 'Entertainment', 'Gamepad2', '#C98500', 'expense', true, 6),
      (uid, 'Travel', 'Plane', '#199E70', 'expense', true, 7),
      (uid, 'Health', 'Pill', '#008300', 'expense', true, 8),
      (uid, 'Education', 'GraduationCap', '#0EA5E9', 'expense', true, 9),
      (uid, 'Clothing', 'Shirt', '#EC4899', 'expense', true, 10),
      (uid, 'Savings', 'PiggyBank', '#22C55E', 'both', true, 11),
      (uid, 'Salary', 'Wallet', '#22C55E', 'income', true, 12),
      (uid, 'Other', 'Package', '#71717A', 'both', true, 13);
  end if;

  select id into cat_food   from public.categories where user_id = uid and name = 'Food';
  select id into cat_car    from public.categories where user_id = uid and name = 'Car';
  select id into cat_house  from public.categories where user_id = uid and name = 'Housing';
  select id into cat_bills  from public.categories where user_id = uid and name = 'Bills';
  select id into cat_shop   from public.categories where user_id = uid and name = 'Shopping';
  select id into cat_fun    from public.categories where user_id = uid and name = 'Entertainment';
  select id into cat_salary from public.categories where user_id = uid and name = 'Salary';

  -- Opening balances stand for money that existed before MoneyFlow; the
  -- triggers move them from here.
  insert into public.accounts (user_id, name, type, balance, currency, color)
  values (uid, 'Cash', 'cash', 1200, 'MDL', '#22C55E') returning id into acc_cash;
  insert into public.accounts (user_id, name, type, balance, currency, color)
  values (uid, 'Victoriabank', 'bank', 6400, 'MDL', '#06B6D4') returning id into acc_vb;
  insert into public.accounts (user_id, name, type, balance, currency, color)
  values (uid, 'MAIB', 'card', 4100, 'MDL', '#8B5CF6') returning id into acc_maib;
  insert into public.accounts (user_id, name, type, balance, currency, color, include_in_total)
  values (uid, 'Economii', 'savings', 0, 'MDL', '#F59E0B', true) returning id into acc_save;

  update public.profiles
     set monthly_income = 15000,
         monthly_savings_target = 2000,
         emergency_fund_target = 45000,
         payday_day = 5,
         onboarding_completed = true,
         is_demo = true
   where user_id = uid;

  -- Three months of history plus the current month so the charts and the
  -- month-over-month comparison have something real to say.
  for m in 0..3 loop
    salary_day := (seed_start + (m || ' months')::interval)::date + 4;
    exit when salary_day > current_date;

    insert into public.transactions
      (user_id, account_id, category_id, type, amount, description, date)
    values (uid, acc_vb, cat_salary, 'income', 15000, 'Salariu', salary_day);

    -- Rent and the phone bill land on the same days every month.
    insert into public.transactions
      (user_id, account_id, category_id, type, amount, description, date)
    values (uid, acc_vb, cat_house, 'expense', 4000, 'Chirie',
            least((seed_start + (m || ' months')::interval)::date + 5, current_date));

    insert into public.transactions
      (user_id, account_id, category_id, type, amount, description, date)
    values (uid, acc_maib, cat_bills, 'expense', 300, 'Internet',
            least((seed_start + (m || ' months')::interval)::date + 9, current_date));

    insert into public.transactions
      (user_id, account_id, category_id, type, amount, description, date)
    values (uid, acc_maib, cat_bills, 'expense', 200, 'Telefon',
            least((seed_start + (m || ' months')::interval)::date + 9, current_date));

    -- A monthly move into savings.
    insert into public.transactions
      (user_id, account_id, to_account_id, type, amount, description, date)
    values (uid, acc_vb, acc_save, 'transfer', 2000, 'Economii lunare',
            least((seed_start + (m || ' months')::interval)::date + 6, current_date));
  end loop;

  -- Day-to-day spending. `pick` is derived from the date so a re-seed produces
  -- the same history rather than a different one every time.
  d := seed_start;
  while d <= current_date loop
    pick := (extract(day from d)::int * 7 + extract(month from d)::int * 3) % 10;

    if pick < 4 then
      target_cat := cat_food;  target_acc := acc_cash;
      amt := 60 + (pick * 37) % 190;
      label := (array['Prânz', 'Cumpărături', 'Cafea', 'Restaurant'])[1 + pick % 4];
    elsif pick < 6 then
      target_cat := cat_car;   target_acc := acc_maib;
      amt := 200 + (pick * 53) % 400;
      label := (array['Benzină', 'Parcare', 'Spălătorie'])[1 + pick % 3];
    elsif pick < 8 then
      target_cat := cat_shop;  target_acc := acc_maib;
      amt := 150 + (pick * 71) % 600;
      label := (array['Haine', 'Casă', 'Electronice'])[1 + pick % 3];
    else
      target_cat := cat_fun;   target_acc := acc_cash;
      amt := 80 + (pick * 29) % 320;
      label := (array['Cinema', 'Bar', 'Jocuri'])[1 + pick % 3];
    end if;

    -- Roughly five spending days a week, not every single day.
    if extract(dow from d)::int <> 0 and (extract(day from d)::int % 3) <> 0 then
      insert into public.transactions
        (user_id, account_id, category_id, type, amount, description, date)
      values (uid, target_acc, target_cat, 'expense', amt, label, d);
    end if;

    d := d + 1;
  end loop;

  -- Budgets for the current month.
  insert into public.budgets (user_id, year, month, amount)
  values (uid, extract(year from current_date)::smallint,
          extract(month from current_date)::smallint, 10000)
  returning id into budget_id;

  for cat in
    select id, name from public.categories where user_id = uid
  loop
    if cat.name = 'Food' then
      insert into public.budget_categories (user_id, budget_id, category_id, amount)
      values (uid, budget_id, cat.id, 3000);
    elsif cat.name = 'Car' then
      insert into public.budget_categories (user_id, budget_id, category_id, amount)
      values (uid, budget_id, cat.id, 2000);
    elsif cat.name = 'Entertainment' then
      insert into public.budget_categories (user_id, budget_id, category_id, amount)
      values (uid, budget_id, cat.id, 1000);
    elsif cat.name = 'Shopping' then
      insert into public.budget_categories (user_id, budget_id, category_id, amount)
      values (uid, budget_id, cat.id, 1500);
    elsif cat.name = 'Housing' then
      insert into public.budget_categories (user_id, budget_id, category_id, amount)
      values (uid, budget_id, cat.id, 4000);
    elsif cat.name = 'Bills' then
      insert into public.budget_categories (user_id, budget_id, category_id, amount)
      values (uid, budget_id, cat.id, 700);
    end if;
  end loop;

  -- Goals, with contributions so the progress bars are real.
  insert into public.goals
    (user_id, name, icon, color, target_amount, monthly_contribution, deadline)
  values (uid, 'Golf 5', 'Car', '#3987E5', 20000, 1000,
          (current_date + interval '8 months')::date)
  returning id into goal_car;

  insert into public.goals
    (user_id, name, icon, color, target_amount, monthly_contribution, deadline)
  values (uid, 'Vacanță', 'Plane', '#9085E9', 10000, 800,
          (current_date + interval '10 months')::date)
  returning id into goal_trip;

  insert into public.goals
    (user_id, name, icon, color, target_amount, monthly_contribution, deadline)
  values (uid, 'Fond de urgență', 'ShieldCheck', '#199E70', 45000, 500, null)
  returning id into goal_fund;

  insert into public.goal_contributions (user_id, goal_id, account_id, amount, date)
  values
    (uid, goal_car, acc_save, 6000, seed_start),
    (uid, goal_car, acc_save, 3500, (seed_start + interval '1 month')::date),
    (uid, goal_car, acc_save, 3000, (seed_start + interval '2 months')::date),
    (uid, goal_trip, acc_save, 1700, (seed_start + interval '1 month')::date),
    (uid, goal_trip, acc_save, 1500, (seed_start + interval '2 months')::date),
    (uid, goal_fund, acc_save, 4000, seed_start);

  -- Recurring charges the daily budget has to plan around.
  insert into public.recurring_transactions
    (user_id, name, amount, type, frequency, next_date, category_id, account_id, is_fixed)
  values
    (uid, 'Chirie', 4000, 'expense', 'monthly',
     (date_trunc('month', current_date) + interval '1 month' + interval '4 days')::date,
     cat_house, acc_vb, true),
    (uid, 'Internet', 300, 'expense', 'monthly',
     (date_trunc('month', current_date) + interval '1 month' + interval '8 days')::date,
     cat_bills, acc_maib, true),
    (uid, 'Telefon', 200, 'expense', 'monthly',
     (date_trunc('month', current_date) + interval '1 month' + interval '8 days')::date,
     cat_bills, acc_maib, true),
    (uid, 'Netflix', 150, 'expense', 'monthly',
     (date_trunc('month', current_date) + interval '1 month' + interval '13 days')::date,
     cat_fun, acc_maib, true);

  -- Debts in both directions.
  insert into public.debts (user_id, person_name, amount, direction, due_date, status, note)
  values
    (uid, 'Ion', 500, 'i_owe', (current_date + interval '12 days')::date, 'open', 'Împrumut'),
    (uid, 'Alex', 1000, 'owed_to_me', (current_date + interval '20 days')::date, 'open', 'Bilete'),
    (uid, 'Maria', 300, 'owed_to_me', (current_date - interval '4 days')::date, 'open', 'Taxi');
end;
$$;

revoke all on function public.mf_seed_demo_data() from public, anon;
revoke all on function public.mf_clear_demo_data() from public, anon;
grant execute on function public.mf_seed_demo_data() to authenticated;
grant execute on function public.mf_clear_demo_data() to authenticated;
