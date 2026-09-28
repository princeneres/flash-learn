#!/usr/bin/env bash
# Regenerates src/types/database.ts from the Neon schema (DATABASE_URL from .env.local if unset).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ] && [ -f .env.local ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d "'\"")
fi
: "${DATABASE_URL:?DATABASE_URL não definido (.env.local ou ambiente)}"

npx neon-js gen-types --db-url "$DATABASE_URL" --output src/types/database.ts
npx prettier --write src/types/database.ts >/dev/null
