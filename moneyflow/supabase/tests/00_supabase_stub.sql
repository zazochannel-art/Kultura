-- ===========================================================================
-- A minimal stand-in for the parts of Supabase the migrations depend on, so
-- the schema can be applied and exercised against a plain PostgreSQL server.
--
-- Not a Supabase emulator and not shipped to production: it exists only so
-- `scripts/verify-schema.sh` can prove the migrations, the triggers and the
-- RLS policies actually behave before anyone points them at a real project.
-- ===========================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create extension if not exists pgcrypto;

-- Supabase grants this in a real project; the app's RLS policies need it.
grant usage on schema auth to anon, authenticated;
