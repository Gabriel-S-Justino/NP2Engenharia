# Testes de produção (pré e pós-deploy)

Ambiente desta verificação: contêiner Linux de desenvolvimento, Python 3.13 (testes) e 3.12 (função gerada pelo
`vercel build`), Node 22, PostgreSQL 16 + pgvector 0.6 local, Chromium do Playwright. **Sem acesso** a
Hugging Face, Docker Hub (429), vercel.com/docs.expo.dev (documentação) e sem contas Vercel/Neon.
Datas: 29–30/10/2026. Legenda: ✅ aprovado · ⏸ não executado · 🔒 bloqueado por credencial/serviço.

## Pré-deploy

### Configuração da Vercel
| Verificação | Estado | Evidência |
|---|---|---|
| `vercel build` oficial (CLI `vercel@latest`) com o `vercel.json` da raiz | ✅ | Build concluído: web exportada, função `api/index.py` em `python3.12` (lido de `.python-version`), dependências instaladas com uv, `maxDuration` 300, cron registrado |
| Pacote da função dentro do limite | ✅ | ~221 MB descompactados (maiores: onnxruntime 64 MB, numpy 54 MB); `apps/` e `docs/` excluídos; fixtures, matrizes e `Documentos/` incluídos |
| Função gerada executada pelo **handler do runtime Python da Vercel** (`vc_handler`) contra Postgres + pgvector | ✅ | health (ok, production, postgres persistente), caminho original e reescrito (`/api/index?path=…`), indexação 3 documentos, pergunta respondida com citação (PDF p. 2), recusa fora do escopo, avaliação 10/10 gravada, cron sem segredo → 403, indexação sem token → 403 |
| Simulação local da Vercel (`scripts/vercel_local.py`: web + `/api` na mesma origem, sem lifespan, `VERCEL=1`, Postgres) | ✅ | E2E 11/11; reinício do processo com pasta de documentos vazia preservou documentos, trechos, histórico e avaliação |
| Web usa a mesma origem sem configurar URL | ✅ | Tela Configurações: "mesma origem"; teste `config.test.ts` |

### Backend e dados
| Verificação | Estado | Evidência |
|---|---|---|
| Lint (ruff) | ✅ | `ruff check app tests ../scripts ../api` |
| Testes SQLite (unidade, integração, API) | ✅ 75 + 7 ignorados | `cd backend && pytest -q` |
| Testes com **Postgres + pgvector** (configuração de produção) | ✅ 82/82 | `TEST_DATABASE_URL=… pytest -q`: persistência entre instâncias, serverless sem arquivos locais, reindexação a partir dos originais no banco, orçamento de tempo com fila pendente, trava entre instâncias, reparo incremental de vetores, upload síncrono, avaliação isolada, bloqueio sem armazenamento persistente, cron |
| Ingestão pela CLI direto no Postgres (fluxo de acervo grande) | ✅ | `DATABASE_URL=… scripts/ingest_documents.py`: 3 documentos e originais gravados |
| Calibração com `--real` não altera parâmetros em uso | ✅ | parâmetro pré-existente preservado após a execução |
| Matriz de avaliação (fixtures) | ✅ 10/10 | `scripts/run_evaluation.py` e via API |
| Modo produção em contêiner/servidor (`APP_ENV=production`) | ✅ | verificado em 29/10 (health, 403 sem token, CORS restrito) |

### Frontend
| Verificação | Estado | Evidência |
|---|---|---|
| Typecheck, lint | ✅ | `npm run typecheck`, `npm run lint` |
| Testes (componentes, cliente HTTP, URL da API, validação, contraste, chat) | ✅ 59/59 | `npm run test:ci` |
| Build web de produção (mesma origem) | ✅ | `npm run build:web` |
| E2E modo local (SQLite) | ✅ 11/11 | `tests/e2e/web_smoke.mjs` — desktop, tablet, celular, teclado |
| E2E modo Vercel simulado (Postgres) | ✅ 11/11 | idem, `WEB_URL=http://127.0.0.1:3000` |
| Segredos no bundle | ✅ | nenhum valor de chave em `dist/` (CI verifica padrão `sk-ant-…`) |

### Não executado / bloqueado
| Item | Estado | Motivo |
|---|---|---|
| Deploy real (preview/produção) | ⏸ 🔒 | requer contas Vercel e Neon da equipe e autorização |
| Embeddings semânticos `fastembed` | ⏸ 🔒 | download do Hugging Face bloqueado neste ambiente (testes usaram `hashing`) |
| Tempo de cold start com download do modelo na Vercel | ⏸ 🔒 | depende do deploy real |
| LLM real | ⏸ 🔒 | sem credencial (adaptador testado com cliente simulado) |
| Imagem Docker (alternativa) | ⏸ 🔒 | Docker Hub retornou 429 |
| Android/iOS, leitores de tela | ⏸ | não disponíveis neste ambiente |

Defeitos encontrados e corrigidos nesta preparação:
1. Fila de indexação podia não avançar se o orçamento de tempo se esgotasse antes do 1º documento (ex.: cold start)
   → garantido ao menos 1 documento por chamada.
2. A web tratava qualquer `localhost` fora da porta 8000 como servidor de desenvolvimento (chamava a porta errada
   na simulação) → regra restrita às portas do Expo (8081/19006).
3. A calibração com `--real` gravava limiares temporários no banco → parâmetros originais restaurados ao final.

Comando único: `TEST_DATABASE_URL=… python scripts/verify_project.py` (gera `docs/resultados/verificacao_projeto.md`).

## Pós-deploy (a executar pela equipe)

| Verificação | Preview | Produção |
|---|---|---|
| `/api/health`: `status ok`, `storage.backend postgres`, `storage.persistent true` | ⏸ | ⏸ |
| Primeira pergunta após deploy responde (cold start com download do modelo) e tempo registrado | ⏸ | ⏸ |
| `/api/health` após a 1ª pergunta: `embeddings.loaded true`, `semantic true` | ⏸ | ⏸ |
| Indexação: upload pela interface (≤ 4 MB) e acervo pela CLI; `remaining = 0` | ⏸ | ⏸ |
| `/api/ingestion/status`: `consistent` e `compatible` | ⏸ | ⏸ |
| E2E: `WEB_URL=<url> ADMIN_TOKEN=<token> node tests/e2e/web_smoke.mjs` | ⏸ | ⏸ |
| Recarregar `/chat` e `/documentos/<id>` direto na URL | ⏸ | ⏸ |
| Operação administrativa sem token → 403; `/api/cron/ingestion` sem segredo → 403 | ⏸ | ⏸ |
| Novo deploy preserva documentos, histórico e avaliações | ⏸ | ⏸ |
| Matriz do acervo real executada (Laboratório) | ⏸ | ⏸ |
| Logs da função sem segredos nem texto de perguntas | ⏸ | ⏸ |

**Estado da entrega: preparada para deploy na Vercel.** Preview e produção **não** foram publicados.
