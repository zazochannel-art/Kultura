#!/usr/bin/env bash
#
# Applies every migration to a throwaway PostgreSQL and asserts the schema
# behaves — triggers, RLS, RPCs, the demo seed, account deletion.
#
# Needs a reachable PostgreSQL 15+. Point it at one with DATABASE_URL, or let
# it start a temporary server on port 55432 if `initdb` is on PATH.
#
#   scripts/verify-schema.sh
#   DATABASE_URL=postgres://... scripts/verify-schema.sh
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

started_server=0
pgdata="${TMPDIR:-/tmp}/moneyflow-pgdata"
socket_dir="${TMPDIR:-/tmp}"

cleanup() {
  if [ "$started_server" = "1" ]; then
    pg_ctl -D "$pgdata" stop -m immediate >/dev/null 2>&1 || true
    rm -rf "$pgdata"
  fi
}
trap cleanup EXIT

if [ -z "${DATABASE_URL:-}" ]; then
  command -v initdb >/dev/null 2>&1 || {
    echo "No DATABASE_URL and no initdb on PATH — nothing to test against." >&2
    exit 2
  }

  rm -rf "$pgdata"
  initdb -D "$pgdata" -U postgres --auth=trust >/dev/null
  pg_ctl -D "$pgdata" -o "-p 55432 -k $socket_dir" -l "$pgdata/server.log" start >/dev/null
  started_server=1

  for _ in $(seq 1 20); do
    psql -h "$socket_dir" -p 55432 -U postgres -tAc 'select 1' >/dev/null 2>&1 && break
    sleep 0.5
  done

  DATABASE_URL="postgres://postgres@localhost:55432/postgres?host=$socket_dir"
fi

# "already exists, skipping" is what re-runnable migrations sound like; only
# warnings and errors are worth printing.
export PGOPTIONS='-c client_min_messages=warning'

run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ resetting schema"
run -c 'drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;' >/dev/null

echo "→ supabase stand-in"
run -f supabase/tests/00_supabase_stub.sql >/dev/null

echo "→ migrations"
for file in supabase/migrations/*.sql; do
  run -f "$file" >/dev/null
  echo "   $(basename "$file")"
done

echo "→ migrations are re-runnable"
for file in supabase/migrations/*.sql; do
  run -f "$file" >/dev/null
done

echo "→ schema checks"
PGOPTIONS='-c client_min_messages=notice' \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/01_schema_checks.sql >/dev/null

echo "✓ schema verified"
