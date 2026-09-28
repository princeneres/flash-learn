#!/usr/bin/env bash
# Applies pending db/migrations/*.sql to DATABASE_URL (read from .env.local if unset).
# Each file runs in its own transaction and is recorded in public.schema_migrations.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ] && [ -f .env.local ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d "'\"")
fi
: "${DATABASE_URL:?DATABASE_URL não definido (.env.local ou ambiente)}"

psql() { command psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

psql -c "create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
)" -c "alter table public.schema_migrations enable row level security" \
   -c "revoke all on public.schema_migrations from authenticated, anonymous"

for file in db/migrations/*.sql; do
  version=$(basename "$file" .sql)
  applied=$(psql -tA -c "select 1 from public.schema_migrations where version = '$version'")
  if [ -n "$applied" ]; then
    continue
  fi
  echo "→ $version"
  psql --single-transaction \
    -f "$file" \
    -c "insert into public.schema_migrations (version) values ('$version')"
done

echo "✓ migrations em dia"
