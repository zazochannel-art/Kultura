-- MontajPro — schema inițială.
--
-- Principii:
--   * fiecare tabel are `id` (uuid generat pe client), `user_id`, `created_at`,
--     `updated_at` și `deleted_at`;
--   * ștergerile sunt logice (`deleted_at`), ca să se propage între dispozitive;
--   * `updated_at` vine de la client și decide conflictele (last write wins),
--     iar `synced_at` este pus de server și este cursorul de sincronizare —
--     așa un telefon cu ceasul deviat nu poate „ascunde” rânduri;
--   * Row Level Security peste tot: fiecare utilizator vede doar ce e al lui.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Funcții comune
-- ---------------------------------------------------------------------------

-- Cursorul de sincronizare este întotdeauna ceasul serverului.
create or replace function public.set_synced_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.synced_at := now();
  if new.created_at is null then
    new.created_at := now();
  end if;
  if new.updated_at is null then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabele
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  type text not null default 'other'
    check (type in ('stairs', 'parquet', 'plinth', 'other')),
  status text not null default 'quote'
    check (status in ('quote', 'confirmed', 'materials', 'in_progress', 'done', 'issue')),
  address text,
  scheduled_date date,
  scheduled_time text,
  estimated_hours numeric(6, 2),
  price_total numeric(12, 2) not null default 0,
  material_cost numeric(12, 2),
  start_date date,
  end_date date,
  notes text,
  in_portfolio boolean not null default false,
  portfolio_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.job_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  kind text not null default 'other'
    check (kind in ('stairs', 'parquet', 'plinth', 'other')),
  label text,
  -- Valorile măsurate diferă de la un tip la altul, deci sunt ținute ca JSON.
  data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  measurement_id uuid references public.job_measurements (id) on delete set null,
  stage text not null default 'before' check (stage in ('before', 'during', 'after')),
  -- Calea din bucket-ul `job-photos`; gol cât timp poza e doar pe telefon.
  storage_path text,
  local_key text,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text,
  quantity numeric(12, 3) not null default 0,
  unit text not null default 'buc',
  price numeric(12, 2) not null default 0,
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.job_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  name text not null,
  quantity numeric(12, 3) not null default 0,
  unit text not null default 'buc',
  unit_price numeric(12, 2) not null default 0,
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  amount numeric(12, 2) not null default 0,
  kind text not null default 'partial' check (kind in ('advance', 'partial', 'final')),
  method text not null default 'cash' check (method in ('cash', 'card', 'transfer', 'other')),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  category text not null default 'other'
    check (category in ('materials', 'fuel', 'tools', 'transport', 'parking', 'car', 'consumables', 'other')),
  amount numeric(12, 2) not null default 0,
  spent_at date not null default current_date,
  note text,
  receipt_path text,
  receipt_local_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number integer not null default 1,
  client_id uuid references public.clients (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected')),
  title text not null default 'Ofertă',
  advance numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  valid_until date,
  notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  description text not null default '',
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'buc',
  unit_price numeric(12, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  model text,
  price numeric(12, 2),
  purchased_at date,
  warranty_months integer,
  notes text,
  photo_path text,
  photo_local_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('job_tomorrow', 'job_today', 'payment_due', 'tool_warranty', 'materials_missing', 'quote_pending')),
  title text not null,
  body text,
  job_id uuid references public.jobs (id) on delete cascade,
  due_date date,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  company text,
  logo_path text,
  logo_local_key text,
  currency text not null default 'MDL',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  default_rates jsonb not null default '{}'::jsonb,
  expense_categories jsonb not null default '[]'::jsonb,
  material_categories jsonb not null default '[]'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  vat_percent numeric(5, 2) not null default 0,
  quote_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Un singur rând de setări activ per utilizator.
create unique index if not exists settings_one_per_user
  on public.settings (user_id)
  where deleted_at is null;

-- Numerele de ofertă nu se repetă în cadrul aceluiași cont.
create unique index if not exists quotes_number_per_user
  on public.quotes (user_id, number)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Indecși, triggere și RLS — identice pentru toate tabelele
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'clients', 'jobs', 'job_measurements', 'job_photos', 'job_materials',
    'materials', 'payments', 'expenses', 'quotes', 'quote_items', 'tools',
    'work_sessions', 'notifications', 'settings'
  ];
begin
  foreach t in array tables loop
    -- Sincronizarea cere mereu „ce s-a schimbat pentru mine după momentul X”.
    execute format(
      'create index if not exists %I on public.%I (user_id, synced_at)',
      t || '_user_synced_idx', t
    );

    execute format('drop trigger if exists %I on public.%I', t || '_synced_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.set_synced_at()',
      t || '_synced_at', t
    );

    execute format('alter table public.%I enable row level security', t);

    -- Patru politici separate: citire, inserare, actualizare, ștergere.
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t
    );
  end loop;
end;
$$;

-- Indecși suplimentari pentru interogările din aplicație.
create index if not exists jobs_client_idx on public.jobs (user_id, client_id);
create index if not exists jobs_scheduled_idx on public.jobs (user_id, scheduled_date);
create index if not exists job_materials_job_idx on public.job_materials (job_id);
create index if not exists job_photos_job_idx on public.job_photos (job_id);
create index if not exists job_measurements_job_idx on public.job_measurements (job_id);
create index if not exists payments_job_idx on public.payments (job_id);
create index if not exists expenses_job_idx on public.expenses (job_id);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);
create index if not exists work_sessions_job_idx on public.work_sessions (job_id);
