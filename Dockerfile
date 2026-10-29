# Backend do Acervo IA (FastAPI + RAG). Imagem para hospedagem com DISCO PERSISTENTE (ex.: Render, Railway, Fly.io).
# Build:  docker build -t acervo-ia-backend .
# Run:    docker run -p 127.0.0.1:8000:8000 -v "$PWD/data:/var/data" acervo-ia-backend
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production \
    API_HOST=0.0.0.0 \
    PORT=8000 \
    DATA_DIR=/var/data \
    DOCUMENTS_DIR=/app/Documentos \
    EMBEDDING_CACHE_DIR=/var/data/models

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Código, matrizes de avaliação, fixtures sintéticas e documentos públicos versionados (se houver).
COPY backend/app backend/app
COPY tests/acceptance tests/acceptance
COPY tests/fixtures tests/fixtures
COPY scripts scripts
COPY Documentos Documentos

# Usuário sem privilégios; somente /var/data é gravável.
RUN useradd --create-home --uid 10001 acervo \
    && mkdir -p /var/data \
    && chown -R acervo:acervo /var/data
USER acervo

WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health',timeout=4)"

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --workers 1"]
