-- ===========================================================================
-- What the schema is supposed to do, asserted against a real PostgreSQL.
--
-- The parts of MONEYFLOW that cannot be unit-tested in TypeScript live here:
-- the bootstrap trigger, the account-balance bookkeeping, the transfer guard,
-- goal progress, Row Level Security in both directions, recurring
-- materialisation, the demo seed, and that deleting an account really does
-- leave nothing behind.
--
-- Run: scripts/verify-schema.sh
-- ===========================================================================

\set ON_ERROR_STOP on
\pset pager off

-- Two users, so isolation can actually be observed.
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'ana@example.md', '{"name":"Ana Pop"}'),
       ('22222222-2222-2222-2222-222222222222', 'bob@example.md', '{"name":"Bob"}');

\echo '--- bootstrap trigger ---'
select (select count(*) from public.profiles)   as profiles,
       (select count(*) from public.categories) as categories,
       (select count(*) from public.accounts)   as accounts;
select name from public.profiles order by name;

\echo '--- balance triggers ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;

insert into public.accounts (user_id, name, type, balance)
values (auth.uid(), 'Victoriabank', 'bank', 6000) returning name, balance;

insert into public.transactions (user_id, account_id, type, amount, date)
select auth.uid(), id, 'income', 15000, current_date from public.accounts where name = 'Victoriabank';

insert into public.transactions (user_id, account_id, type, amount, date)
select auth.uid(), id, 'expense', 4000, current_date from public.accounts where name = 'Victoriabank';

insert into public.transactions (user_id, account_id, to_account_id, type, amount, date)
select auth.uid(),
       (select id from public.accounts where name = 'Victoriabank'),
       (select id from public.accounts where name = 'Cash'),
       'transfer', 2000, current_date;

select name, balance from public.accounts order by name;

\echo '--- editing a transaction re-derives the balance ---'
update public.transactions set amount = 5000
 where type = 'expense' and amount = 4000;
select name, balance from public.accounts where name = 'Victoriabank';

\echo '--- deleting a transaction gives the money back ---'
delete from public.transactions where type = 'expense';
select name, balance from public.accounts where name = 'Victoriabank';

\echo '--- transfer guard rejects a self-transfer ---'
do $$
begin
  insert into public.transactions (user_id, account_id, to_account_id, type, amount, date)
  select auth.uid(), id, id, 'transfer', 100, current_date from public.accounts limit 1;
  raise exception 'self-transfer was allowed';
exception when check_violation then
  raise notice 'self-transfer rejected, as expected';
end $$;

\echo '--- goal contributions drive goal progress ---'
insert into public.goals (user_id, name, target_amount, monthly_contribution)
values (auth.uid(), 'Golf 5', 20000, 1000);
insert into public.goal_contributions (user_id, goal_id, amount, date)
select auth.uid(), id, 12500, current_date from public.goals where name = 'Golf 5';
select name, current_amount, status from public.goals;

insert into public.goal_contributions (user_id, goal_id, amount, date)
select auth.uid(), id, 7500, current_date from public.goals where name = 'Golf 5';
select name, current_amount, status from public.goals;

\echo '--- RLS: Ana sees only her own rows ---'
select count(*) as ana_sees_profiles from public.profiles;
select count(*) as ana_sees_accounts from public.accounts;

\echo '--- RLS: Bob sees none of Ana rows ---'
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) as bob_sees_ana_transactions from public.transactions
 where user_id = '11111111-1111-1111-1111-111111111111';
select count(*) as bob_sees_profiles from public.profiles;

\echo '--- RLS: Bob cannot write rows owned by Ana ---'
do $$
begin
  insert into public.accounts (user_id, name, type)
  values ('11111111-1111-1111-1111-111111111111', 'Hijack', 'cash');
  raise exception 'cross-user insert was allowed';
exception when insufficient_privilege then
  raise notice 'cross-user insert rejected, as expected';
end $$;

\echo '--- recurring materialisation is idempotent ---'
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
insert into public.recurring_transactions (user_id, name, amount, type, frequency, next_date, account_id)
select auth.uid(), 'Netflix', 150, 'expense', 'monthly', current_date - 40,
       (select id from public.accounts where user_id = auth.uid() limit 1);
select public.mf_run_due_recurring() as posted_first_run;
select public.mf_run_due_recurring() as posted_second_run;
select count(*) as netflix_rows from public.transactions where description = 'Netflix';
select next_date > current_date as next_date_moved_forward from public.recurring_transactions;

\echo '--- demo seed ---'
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select public.mf_seed_demo_data();
select (select count(*) from public.transactions where user_id = auth.uid()) as demo_transactions,
       (select count(*) from public.goals where user_id = auth.uid())        as demo_goals,
       (select count(*) from public.budget_categories where user_id = auth.uid()) as demo_budget_lines,
       (select count(*) from public.debts where user_id = auth.uid())        as demo_debts,
       (select is_demo from public.profiles where user_id = auth.uid())      as flagged_demo;

\echo '--- reporting RPCs ---'
select count(*) as monthly_rows from public.mf_monthly_totals(current_date - 120, current_date);
select name, total from public.mf_category_totals(date_trunc('month', current_date)::date, current_date, 'expense') limit 3;
select count(*) as balance_points from public.mf_balance_series(current_date - 6, current_date);

\echo '--- demo clear leaves nothing behind ---'
select public.mf_clear_demo_data();
select (select count(*) from public.transactions where user_id = auth.uid()) as after_clear_transactions,
       (select count(*) from public.accounts where user_id = auth.uid())     as after_clear_accounts,
       (select is_demo from public.profiles where user_id = auth.uid())      as after_clear_flag;

\echo '--- account deletion cascades ---'
reset role;
select count(*) as ana_rows_before from public.transactions where user_id = '11111111-1111-1111-1111-111111111111';
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select (select count(*) from public.transactions where user_id = '11111111-1111-1111-1111-111111111111') as tx_after,
       (select count(*) from public.profiles where user_id = '11111111-1111-1111-1111-111111111111')     as profile_after,
       (select count(*) from public.accounts where user_id = '11111111-1111-1111-1111-111111111111')     as accounts_after;
