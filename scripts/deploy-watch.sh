#!/usr/bin/env bash
# Acompanha o deploy mais recente na Vercel (disparado por `git push` ou `vercel`).
#   1. pega o deployment mais recente do projeto
#   2. faz polling do status até virar Ready / Error / Canceled
#   3. em caso de erro, despeja os logs de build para diagnóstico
#
# Uso:
#   bash scripts/deploy-watch.sh            # acompanha o último deployment
#   bash scripts/deploy-watch.sh <url>      # acompanha um deployment específico
#
# Sai com código 0 se Ready, 1 se Error/Canceled, 2 se timeout.
set -euo pipefail

PROJECT="flash-learn-v2"
POLL_INTERVAL=10      # segundos entre cada checagem
MAX_WAIT=600          # timeout total (10 min)

cd "$(dirname "$0")/.."

url="${1:-}"
if [ -z "$url" ]; then
  echo "▸ Buscando o deployment mais recente de $PROJECT..."
  url="$(npx vercel ls "$PROJECT" 2>/dev/null | grep -m1 'https://')"
fi
if [ -z "$url" ]; then
  echo "  ⚠ Nenhum deployment encontrado." >&2
  exit 1
fi
echo "▸ Acompanhando: $url"

elapsed=0
status=""
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  # extrai só o valor da linha "status" do inspect.
  # IMPORTANTE: remover os códigos ANSI ANTES do grep (o label "status" vem colorido).
  status="$(npx vercel inspect "$url" 2>&1 \
    | sed -E 's/\x1b\[[0-9;]*m//g' \
    | grep -E '^[[:space:]]*status[[:space:]]' \
    | sed -E 's/.*status[[:space:]]+//; s/^[^A-Za-z]*//; s/[^A-Za-z].*//' || true)"
  printf '  [%3ds] status: %s\n' "$elapsed" "${status:-?}"
  case "$status" in
    Ready)
      echo "✅ Deploy concluído com sucesso: $url"
      exit 0 ;;
    Error|Canceled)
      echo "❌ Deploy falhou (status: $status). Logs de build:"
      echo "----------------------------------------------------------------"
      npx vercel inspect "$url" --logs 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | tail -60
      echo "----------------------------------------------------------------"
      exit 1 ;;
  esac
  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
done

echo "⚠ Timeout após ${MAX_WAIT}s — deploy ainda em '$status'." >&2
exit 2
