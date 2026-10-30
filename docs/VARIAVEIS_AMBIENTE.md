# Inventário de variáveis de ambiente

Arquivo de exemplo: `.env.example` (sem segredos). O `.env` real é ignorado pelo Git.
**Nunca cole segredos no chat, em issues ou no código**: na Vercel, use *Settings → Environment Variables*;
localmente, o arquivo `.env`.

Legenda da coluna Vercel: **definir** = configure no painel; **auto** = definido pela integração/plataforma;
**padrão** = o valor automático já serve; — = não se aplica.

| Variável | Finalidade | Padrão local | Na Vercel | Tipo |
|---|---|---|---|---|
| `DATABASE_URL` | Postgres com pgvector (dados, vetores, originais). Também aceita `POSTGRES_URL` | — (usa SQLite) | **auto** (integração Neon) | **SEGREDO** |
| `ADMIN_TOKEN` | Token das operações administrativas (header `X-Admin-Token`) | — (livre em desenvolvimento) | **definir** (obrigatório em produção) | **SEGREDO** |
| `CRON_SECRET` | Autoriza `/api/cron/ingestion` (a Vercel envia `Authorization: Bearer …`) | — | **definir** (recomendado) | **SEGREDO** |
| `LLM_API_KEY` | Chave do provedor de LLM | — | definir se `LLM_PROVIDER=anthropic` | **SEGREDO** |
| `LLM_PROVIDER` | `demo` (extrativo, sem LLM) ou `anthropic` | demo | definir para usar LLM | servidor |
| `LLM_MODEL` | Modelo de geração | claude-opus-5-5 | padrão | servidor |
| `LLM_TIMEOUT_SECONDS` / `LLM_MAX_OUTPUT_TOKENS` / `LLM_EFFORT` | Limites da geração | 60 / 2048 / low | padrão | servidor |
| `SERVERLESS` | Modo serverless (síncrono, em lotes, carga sob demanda) | detecta `VERCEL=1` | **auto** | servidor |
| `APP_ENV` | development, test ou production | development | **auto** = production | servidor |
| `VECTOR_STORE` | `faiss`, `numpy` ou `pgvector` | faiss (pgvector se houver `DATABASE_URL`) | **auto** = pgvector | servidor |
| `STORE_ORIGINALS_IN_DB` | Guardar originais no banco | sim com Postgres | **auto** = sim | servidor |
| `PRUNE_MISSING_FILES` | Remover do índice documentos cujo arquivo sumiu da pasta | sim | **auto** = não | servidor |
| `INGESTION_TIME_BUDGET_SECONDS` | Tempo máximo de cada chamada de indexação (restante fica pendente) | 240 (só usado em serverless) | padrão (< `maxDuration` 300) | servidor |
| `ALLOW_EPHEMERAL_STORAGE` | Permitir indexar sem banco persistente (dados perdidos) | false | só em demonstrações | servidor |
| `EMBEDDING_PROVIDER` | `fastembed` (semântico, local) ou `hashing` (lexical, testes) | fastembed | padrão | servidor |
| `EMBEDDING_MODEL` | Modelo do fastembed | paraphrase-multilingual-MiniLM-L12-v2 | padrão | servidor |
| `EMBEDDING_CACHE_DIR` | Cache do modelo baixado | cache do fastembed | **auto** = `/tmp/fastembed-cache` | servidor |
| `HASHING_DIM` | Dimensão do provedor lexical | 2048 | — | servidor |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `MIN_CHUNK_CHARS` | Chunking (caracteres) | 800 / 120 / 60 | padrão (ou tela Configurações) | servidor |
| `TOP_K` | Trechos recuperados | 5 | padrão | servidor |
| `SIMILARITY_THRESHOLD` | Limiar de similaridade | por provedor (0,15 hashing; 0,35 fastembed) | **definir** após calibrar | servidor |
| `WEAK_EVIDENCE_MARGIN` / `MIN_TERM_COVERAGE` | Evidência fraca / cobertura (modo demo) | 0,08 / 0,5 | padrão | servidor |
| `MAX_UPLOAD_SIZE_MB` | Limite por arquivo | 20 | **auto** = 4 (limite de 4,5 MB por requisição) | servidor |
| `MAX_QUESTION_CHARS` / `MAX_REQUEST_BODY_MB` | Limites de entrada | 1000 / 25 | padrão | servidor |
| `RATE_LIMIT_PER_MINUTE` | Perguntas por minuto por cliente (por instância) | 30 | padrão | servidor |
| `HISTORY_RETENTION_DAYS` | Retenção do histórico de chat | 30 | padrão | servidor |
| `OCR_ENABLED` | OCR opcional (requer Tesseract) | false | não disponível na função | servidor |
| `AUTO_INGEST_ON_STARTUP` | Indexar ao iniciar | false | **auto** = desligado (use o cron) | servidor |
| `DOCUMENTS_DIR` / `DATA_DIR` | Pasta dos documentos / dados locais | `Documentos` / `data` | padrão / **auto** = `/tmp/acervo-data` | servidor |
| `CORS_ORIGINS` | Origens web autorizadas (outro domínio) | localhost:8081… | desnecessário (mesma origem) | servidor |
| `API_HOST` / `API_PORT` / `PORT` | Servidor local / contêiner | 127.0.0.1 / 8000 | — | servidor |
| `LOG_LEVEL` | Nível de log | INFO | padrão | servidor |
| `EXPO_PUBLIC_API_URL` | URL do backend no app | vazio (web publicada = mesma origem; Expo web dev = 127.0.0.1:8000; Android = 10.0.2.2:8000) | **não definir** para a web | **PÚBLICA** (vai no bundle) |

Variáveis usadas apenas por testes e scripts: `TEST_DATABASE_URL` (testes com Postgres), `WEB_URL`,
`ADMIN_TOKEN`, `SHOTS_DIR` (E2E).
