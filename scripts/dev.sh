#!/usr/bin/env bash
# Inicia backend (http://127.0.0.1:8000) e frontend web (Expo, http://localhost:8081).
# Uso: ./scripts/dev.sh          -> acervo real (Documentos/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$#" -gt 0 ]; then
  echo "Uso: ./scripts/dev.sh (configure LLM_API_KEY; documentos adicionados manualmente)." >&2
  exit 1
fi

(cd backend && .venv/bin/uvicorn app.main:app --host "${API_HOST:-127.0.0.1}" --port "${API_PORT:-8000}" --reload) &
BACK=$!
trap 'kill $BACK 2>/dev/null || true' EXIT
(cd apps/mobile && EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:8000}" npx expo start --web)
