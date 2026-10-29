# Testes de produção (pré e pós-deploy)

Ambiente desta verificação: contêiner Linux de desenvolvimento, Python 3.13.17, Node 22.22, Chromium do
Playwright, **sem acesso** a Hugging Face, Docker Hub (429), docs.expo.dev e contas Vercel/Render.
Data: 29/10/2026. Legenda: ✅ aprovado · ❌ falhou · ⏸ não executado · 🔒 bloqueado por credencial/serviço.

## Pré-deploy (local)

| Verificação | Estado | Evidência / comando |
|---|---|---|
| Instalação limpa do backend (venv + requirements) | ✅ | `scripts/setup.sh` (passos executados manualmente no ambiente) |
| Instalação do frontend (`npm install` → `package-lock.json`) | ✅ | `apps/mobile` |
| Lint backend (ruff) | ✅ | `ruff check app tests ../scripts` |
| Testes backend (unidade + integração + API) | ✅ 73/73 | `cd backend && pytest -q` |
| Typecheck frontend | ✅ | `npm run typecheck` |
| Lint frontend (eslint-config-expo, regras do React Compiler) | ✅ | `npm run lint` |
| Testes frontend (componentes, cliente HTTP, validação, contraste, tela de chat) | ✅ 55/55 | `npm run test:ci` |
| Build web de produção | ✅ | `npx expo export --platform web` → `dist/` (SPA, 13 bundles) |
| Contrato frontend ↔ API real | ✅ | E2E abaixo (sem mocks) |
| Health check | ✅ | `GET /api/health` |
| CORS e URLs | ✅ | testes `test_cors_restricted`; modo produção recusou origem desconhecida |
| Upload e recuperação de documentos | ✅ | `test_upload_*`, E2E "Indexar pasta" |
| Persistência dos dados e do índice após reinício | ✅ | `test_index_persists_and_reloads`, `test_index_rebuilt_when_inconsistent` |
| Fluxo pergunta → recuperação → resposta → citações | ✅ | testes de integração + E2E |
| Ausência de evidência, timeout e falha do provedor | ✅ | `test_absent_*`, `test_llm_unavailable_*`, `api.test.ts` (timeout) |
| Segurança básica (token, injeção, path traversal, uploads, segredos) | ✅ | ver SEGURANCA.md |
| Segredos no bundle web | ✅ | nenhum valor de chave em `dist/` (só o texto de ajuda que cita o *nome* `LLM_API_KEY`) |
| Matriz de avaliação (fixtures) | ✅ 10/10 | `scripts/run_evaluation.py` |
| Modo produção do backend (`APP_ENV=production`, mesmo comando do contêiner) | ✅ | health ok; operações administrativas sem token → 403; auto-indexação na inicialização; CORS restrito |
| E2E web contra backend real (Playwright) | ✅ 11/11 | `node tests/e2e/web_smoke.mjs` — desktop 1366, tablet 820, celular 390; teclado; capturas em `docs/capturas/` |
| Build da imagem Docker | ⏸ 🔒 | Docker Hub retornou 429 (limite) ao baixar `python:3.13-slim` |
| Embeddings semânticos (fastembed) | ⏸ 🔒 | download do Hugging Face bloqueado neste ambiente; falha controlada verificada |
| Geração com LLM real | ⏸ 🔒 | sem credencial; adaptador testado com cliente simulado |
| Android/iOS (Expo Go, emulador ou dispositivo) | ⏸ | não disponível neste ambiente |
| Leitores de tela reais | ⏸ | não disponível neste ambiente |

Defeitos encontrados e corrigidos durante estas verificações (antes da entrega):
1. Itens do menu não respondiam a **Enter** (E2E de teclado) → passaram a ser links reais do Expo Router.
2. Ícones e rótulos do menu empilhados após a mudança acima (inspeção das capturas) → estilo achatado para o `<a>`.
3. Texto desabilitado com contraste 4,13:1 (teste de tokens) → ajustado para ≥ 4,7:1.
4. `@expo/vector-icons` sem `expo-font`/`expo-asset` instalados (falha nos testes) → dependências adicionadas.
5. Ordenação de execuções de ingestão com mesmo timestamp → desempate por `rowid`.

Comando único de verificação: `python scripts/verify_project.py` (gera `docs/resultados/verificacao_projeto.md`).

## Pós-deploy (a executar pela equipe)

| Verificação | Preview | Produção |
|---|---|---|
| `GET /api/health` = ok, `embeddings.semantic = true` | ⏸ | ⏸ |
| `/api/ingestion/status` → `consistent` e `compatible` | ⏸ | ⏸ |
| E2E: `WEB_URL=<url> ADMIN_TOKEN=<token> node tests/e2e/web_smoke.mjs` | ⏸ | ⏸ |
| Recarregar `/chat` e `/documentos/<id>` direto na URL (rewrite SPA) | ⏸ | ⏸ |
| Console do navegador sem erros de CORS/mixed content | ⏸ | ⏸ |
| Operação administrativa sem token → 403 | ⏸ | ⏸ |
| Reiniciar backend e confirmar persistência (documentos, índice, histórico) | ⏸ | ⏸ |
| Matriz do acervo real executada | ⏸ | ⏸ |
| Logs da plataforma sem segredos nem texto de perguntas | ⏸ | ⏸ |

**Estado da entrega: preparada para deploy.** Preview e produção **não** foram publicados.
