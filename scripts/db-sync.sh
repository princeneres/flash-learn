#!/usr/bin/env bash
# Sincroniza o projeto local com o Supabase remoto, de forma automática:
#   1. garante que o projeto está linkado
#   2. faz pull do schema remoto (auto-repara o histórico de migrations se divergir)
#   3. regenera os tipos TypeScript
# Idempotente: pode ser rodado quantas vezes quiser.
set -euo pipefail

PROJECT_REF="txjyqvaijuvuzpplhxag"
TYPES_FILE="src/types/database.ts"

cd "$(dirname "$0")/.."

echo "▸ Verificando link com o projeto Supabase..."
if [ ! -f supabase/.temp/project-ref ]; then
  echo "  projeto não linkado — linkando ($PROJECT_REF)..."
  supabase link --project-ref "$PROJECT_REF"
fi

echo "▸ Puxando schema remoto (supabase db pull)..."
pull_output="$(printf 'Y\n' | supabase db pull 2>&1 || true)"
echo "$pull_output"

if echo "$pull_output" | grep -q "migration history does not match"; then
  echo "▸ Histórico de migrations divergente — aplicando os reparos sugeridos pela CLI..."
  # A própria CLI imprime os comandos exatos de reparo (applied OU reverted).
  # Executamos só esses, em vez de forçar tudo como 'applied'.
  repair_lines="$(echo "$pull_output" | grep -E '^[[:space:]]*supabase migration repair ')"
  if [ -z "$repair_lines" ]; then
    echo "  ⚠ Nenhum comando de reparo encontrado na saída da CLI — resolva manualmente." >&2
    exit 1
  fi
  echo "$repair_lines" | while read -r _sb _mig _rep _flag status version; do
    echo "  > repair $version => $status"
    supabase migration repair --status "$status" "$version"
  done
  echo "▸ Repetindo o pull..."
  printf 'Y\n' | supabase db pull
fi

echo "▸ Regenerando tipos TypeScript ($TYPES_FILE)..."
mkdir -p "$(dirname "$TYPES_FILE")"
supabase gen types typescript --linked >"$TYPES_FILE"

echo "✅ Sync concluído — tipos atualizados em $TYPES_FILE"
