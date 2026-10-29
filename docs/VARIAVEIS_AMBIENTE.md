# Inventário de variáveis de ambiente

Arquivo de exemplo: `.env.example` (sem segredos). O arquivo `.env` real é ignorado pelo Git.
**Nunca cole segredos no chat, em issues ou no código**: configure-os no painel da hospedagem ou em `.env` local.

| Variável | Finalidade | Obrigatória | Padrão | Ambiente | Pública? | Onde configurar |
|---|---|---|---|---|---|---|
| `APP_ENV` | development, test ou production (produção exige token para operações administrativas e proíbe CORS `*`) | não | development | todos | servidor | `.env` / painel do backend |
| `API_HOST` | Interface de rede do servidor local | não | 127.0.0.1 | dev | servidor | `.env` (0.0.0.0 só para celular na rede local) |
| `API_PORT` | Porta local | não | 8000 | dev | servidor | `.env` |
| `PORT` | Porta do contêiner | não | 8000 | produção | servidor | definida pela plataforma |
| `CORS_ORIGINS` | Origens web autorizadas (vírgulas) | sim em produção | localhost:8081… | todos | servidor | painel do backend |
| `LOG_LEVEL` | Nível de log | não | INFO | todos | servidor | `.env` / painel |
| `DOCUMENTS_DIR` | Pasta dos documentos originais | não | `Documentos` | todos | servidor | `.env` / Dockerfile |
| `DATA_DIR` | Banco, índice, uploads, relatórios | não | `data` (`/var/data` no Docker) | todos | servidor | `.env` / Dockerfile |
| `VECTOR_STORE` | `faiss` ou `numpy` | não | faiss | todos | servidor | `.env` |
| `EMBEDDING_PROVIDER` | `fastembed` (semântico) ou `hashing` (lexical, testes) | não | fastembed | todos | servidor | `.env` / painel |
| `EMBEDDING_MODEL` | Modelo do fastembed | não | paraphrase-multilingual-MiniLM-L12-v2 | todos | servidor | `.env` |
| `EMBEDDING_CACHE_DIR` | Cache do modelo baixado | não | cache do fastembed (`/var/data/models` no Docker) | produção | servidor | Dockerfile |
| `HASHING_DIM` | Dimensão do provedor lexical | não | 2048 | testes | servidor | `.env` |
| `LLM_PROVIDER` | `demo` ou `anthropic` | não | demo | todos | servidor | `.env` / painel |
| `LLM_MODEL` | Modelo de geração | não | claude-opus-5-5 | todos | servidor | `.env` / painel |
| `LLM_API_KEY` | Chave do provedor de LLM | sim se `anthropic` | — | todos | **SEGREDO** | painel do backend / `.env` local |
| `LLM_TIMEOUT_SECONDS` | Tempo máximo de geração | não | 60 | todos | servidor | `.env` |
| `LLM_MAX_OUTPUT_TOKENS` | Tamanho máximo da resposta | não | 2048 | todos | servidor | `.env` |
| `LLM_EFFORT` | Esforço do modelo (low/medium/high) | não | low | todos | servidor | `.env` |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Chunking (caracteres) | não | 800 / 120 | todos | servidor | `.env` ou tela Configurações |
| `MIN_CHUNK_CHARS` | Tamanho mínimo de trecho | não | 60 | todos | servidor | `.env` |
| `TOP_K` | Trechos recuperados | não | 5 | todos | servidor | `.env` ou Configurações |
| `SIMILARITY_THRESHOLD` | Limiar de similaridade | não | por provedor (0,15 hashing; 0,35 fastembed) | todos | servidor | `.env` ou Configurações |
| `WEAK_EVIDENCE_MARGIN` | Margem para "evidência fraca" | não | 0,08 | todos | servidor | `.env` |
| `MIN_TERM_COVERAGE` | Cobertura mínima de termos (modo demo) | não | 0,5 | todos | servidor | `.env` |
| `MAX_UPLOAD_SIZE_MB` | Limite por arquivo | não | 20 | todos | servidor | `.env` / painel |
| `MAX_QUESTION_CHARS` | Limite por pergunta | não | 1000 | todos | servidor | `.env` |
| `MAX_REQUEST_BODY_MB` | Limite do corpo da requisição | não | 25 | todos | servidor | `.env` |
| `ADMIN_TOKEN` | Token das operações administrativas | sim em produção | — | todos | **SEGREDO** | painel do backend |
| `RATE_LIMIT_PER_MINUTE` | Perguntas por minuto por cliente (0 = sem limite) | não | 30 | todos | servidor | `.env` / painel |
| `AUTO_INGEST_ON_STARTUP` | Indexa novos/alterados ao iniciar | não | false | produção | servidor | painel |
| `HISTORY_RETENTION_DAYS` | Retenção do histórico de chat (0 = sem expurgo) | não | 30 | todos | servidor | `.env` / painel |
| `OCR_ENABLED` | OCR opcional para PDFs digitalizados | não | false | todos | servidor | `.env` |
| `EXPO_PUBLIC_API_URL` | URL do backend usada pelo app | sim fora do dev local | 127.0.0.1:8000 (10.0.2.2 no emulador Android) | build do frontend | **PÚBLICA** (vai no bundle) | Vercel (Preview/Production) / terminal |

Variáveis usadas apenas pelo teste E2E: `WEB_URL`, `ADMIN_TOKEN`, `SHOTS_DIR`.
