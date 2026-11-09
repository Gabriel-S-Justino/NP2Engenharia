#!/usr/bin/env bash
# Instala as dependências do backend (Python) e do frontend (Expo). Uso: ./scripts/setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Backend: ambiente virtual em backend/.venv"
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements-dev.txt

echo "==> Frontend: dependências em apps/mobile"
(cd apps/mobile && npm ci)

backend/.venv/bin/python scripts/configure_local.py
echo "Adicione seus documentos manualmente em Documentos/ e configure LLM_API_KEY no .env."
echo "Pronto. Inicie com ./scripts/dev.sh"
