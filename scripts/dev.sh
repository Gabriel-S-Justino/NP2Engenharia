#!/usr/bin/env bash
# Inicia backend (http://127.0.0.1:8000) e frontend web (Expo, http://localhost:8081).
# Uso: ./scripts/dev.sh          -> acervo real (Documentos/)
#      ./scripts/dev.sh --demo   -> modo demonstração offline com documentos SINTÉTICOS de teste
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "${1:-}" = "--demo" ]; then
  export EMBEDDING_PROVIDER=hashing LLM_PROVIDER=demo
  export DOCUMENTS_DIR="tests/fixtures/documentos_sinteticos" DATA_DIR="data/demo"
  echo "MODO DEMONSTRAÇÃO: embeddings lexicais, gerador extrativo (sem LLM) e documentos sintéticos."
fi

(cd backend && .venv/bin/uvicorn app.main:app --host "${API_HOST:-127.0.0.1}" --port "${API_PORT:-8000}" --reload) &
BACK=$!
trap 'kill $BACK 2>/dev/null || true' EXIT
(cd apps/mobile && EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-http://127.0.0.1:8000}" npx expo start --web)
