"""Entrypoint da função Python na Vercel: expõe a aplicação FastAPI do backend.

O `vercel.json` reescreve `/api/*` para esta função; as rotas do FastAPI já usam o prefixo `/api`.
Na Vercel (VERCEL=1) o backend entra em modo serverless: Postgres/pgvector via DATABASE_URL, modelo de
embeddings carregado sob demanda em /tmp e ingestão síncrona em lotes (ver docs/DEPLOY_VERCEL.md).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.vercel import RestoreRewrittenPath  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

app = RestoreRewrittenPath(fastapi_app)
