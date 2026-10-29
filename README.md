# Acervo IA — consulta a leis de trânsito com fontes verificáveis

Trabalho da disciplina **Engenharia de Inteligência Artificial**. Aplicação **RAG** (Retrieval-Augmented
Generation) web e mobile que responde perguntas **somente** com base em documentos selecionados pela equipe,
mostra os trechos que sustentam cada resposta e **recusa** quando não há evidência suficiente.

> **Estado atual:** software implementado e validado localmente com documentos **sintéticos de teste**.
> O acervo **real** (mín. 10 documentos ou 25 páginas úteis) ainda precisa ser reunido e validado pela equipe
> em [`Documentos/`](Documentos/README.md). Veja a [matriz de conformidade](docs/CONFORMIDADE.md).

## Problema, público e por que RAG

- **Problema:** falta de conhecimento sobre as leis de trânsito e dificuldade de acesso a ferramentas educativas.
  A informação existe (CTB, resoluções do CONTRAN, cartilhas), mas está espalhada em documentos longos e técnicos.
- **Público-alvo:** motoristas iniciantes e pessoas interessadas em aprender as leis de trânsito.
- **Por que RAG:** perguntas em linguagem natural ("posso dirigir com a permissão vencida?") raramente usam as
  mesmas palavras da lei. A busca semântica encontra o trecho certo, e a geração o explica — **citando a fonte**,
  o que é essencial num tema normativo em que respostas inventadas podem causar dano. Uma busca convencional
  (Ctrl+F/palavra-chave) basta quando o usuário já conhece o termo exato ("Art. 165") — ver
  [docs/RELATORIO.md §3](docs/RELATORIO.md).

## Funcionalidades

| Área | O que faz |
|---|---|
| Ingestão | PDF/TXT/MD de `Documentos/` e uploads; SHA-256 para detectar alterações e duplicatas; páginas e seções preservadas; falhas por documento sem interromper o lote; arquivos originais nunca alterados |
| Indexação | Chunks configuráveis (800/120 caracteres), embeddings semânticos locais (`fastembed`), índice **FAISS** persistido em disco com verificação de compatibilidade e reconstrução automática |
| Recuperação | Similaridade de cosseno, top-k, limiar calibrável, filtros por documento/tipo/assunto, cobertura de termos ponderada por IDF |
| Geração | Claude (`LLM_PROVIDER=anthropic`) com contexto delimitado, ou **modo demonstração** extrativo e determinístico (não é LLM) |
| Citações | Montadas pelo backend a partir dos metadados reais; rótulos inventados pelo modelo são removidos e sinalizados |
| Segurança | Recusa segura, bloqueio de instruções maliciosas, trechos suspeitos tratados como dados, token administrativo, limite de requisições, CORS restrito, validação real de uploads |
| Avaliação | Matriz executável 6/2/2 com taxa de aprovação, resultados por categoria, Recall@k, MRR e registro de ajustes |
| Interface | Dashboard, chat com painel de evidências, biblioteca, fontes, laboratório de testes, diário da IA mentora, configurações; tema claro/escuro; web, Android e iOS |

## Tecnologias

Backend: Python 3.11+ (testado em 3.13), FastAPI, Pydantic, SQLite, FAISS, fastembed (ONNX), pypdf, SDK `anthropic`, Pytest.
Frontend: React Native 0.88, Expo SDK 58, Expo Router, React Native Web, TypeScript 6, Jest + Testing Library.
Deploy: frontend estático na **Vercel**; backend em contêiner com **disco persistente** (Render/Railway/Fly.io).

## Estrutura

```
├── apps/mobile/          # Expo (web/Android/iOS): src/app (rotas), src/components, src/services, src/theme…
├── backend/              # FastAPI: app/api, app/core, app/services (pipeline RAG), app/repositories, tests/
├── Documentos/           # documentos REAIS da equipe (README, manifest.json)
├── data/                 # derivados: SQLite, índice FAISS, uploads, relatórios (não versionado)
├── tests/fixtures/       # documentos SINTÉTICOS de teste (fictícios)
├── tests/acceptance/     # matrizes de avaliação e conjunto de calibração
├── tests/e2e/            # teste ponta a ponta web (Playwright)
├── scripts/              # setup, dev, ingestão, avaliação, calibração, inventário, verificação
└── docs/                 # relatório, arquitetura, testes, UI/UX, deploy, conformidade
```

## Executar localmente

Pré-requisitos: Python 3.11+, Node.js 20+ (testado com 22) e npm.

```bash
./scripts/setup.sh
```

```bash
./scripts/dev.sh --demo
```

O modo `--demo` funciona **sem internet e sem chaves**: usa os documentos sintéticos, embeddings lexicais e o
gerador extrativo. Abra http://localhost:8081, vá em **Documentos → Indexar pasta** e pergunte no **Assistente**
("Qual é a velocidade máxima nas vias escolares de Vila Exemplo?"). No Windows: `.\scripts\setup.ps1` e
`.\scripts\dev.ps1 -Demo`.

Com o acervo real (`./scripts/dev.sh`), o backend usa embeddings semânticos `fastembed`; na primeira execução
o modelo (~120 MB) é baixado do Hugging Face.

Manualmente, em dois terminais:

```bash
cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd apps/mobile && EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npx expo start --web
```

Documentação da API (OpenAPI): http://127.0.0.1:8000/docs

### Android e iOS (Expo)

```bash
cd apps/mobile && EXPO_PUBLIC_API_URL=http://SEU_IP_NA_REDE:8000 npx expo start
```

Leia o QR code com o **Expo Go**. O backend deve ouvir na rede local (`API_HOST=0.0.0.0`) e o `CORS_ORIGINS`
não interfere em apps nativos. Emulador Android: use `http://10.0.2.2:8000`. **Não use `localhost` em
celular físico** — ele aponta para o próprio celular. Exponha a API na rede apenas em redes confiáveis.

## Adicionar e indexar documentos

1. Copie PDFs/TXT para `Documentos/` e preencha `Documentos/manifest.json` (exemplo em `manifest.example.json`).
2. Confira o inventário: `backend/.venv/bin/python scripts/inventario_documentos.py`
3. Indexe pela interface (**Documentos → Indexar pasta**) ou pelo terminal:

```bash
backend/.venv/bin/python scripts/ingest_documents.py
```

4. Calibre o limiar para o modelo e o acervo reais (ver [docs/RELATORIO.md §8](docs/RELATORIO.md)):

```bash
backend/.venv/bin/python scripts/calibrate_threshold.py --set tests/acceptance/calibracao_real.json --real
```

## Provedor de IA

Configure **no servidor** (arquivo `.env` local ou painel da hospedagem), nunca no aplicativo:

```
LLM_PROVIDER=anthropic
LLM_API_KEY=<sua chave>
LLM_MODEL=claude-opus-5-5
```

Sem chave, use `LLM_PROVIDER=demo`: o gerador **extrativo** copia frases dos trechos recuperados com citação.
Ele **não é um LLM**, não parafraseia nem infere — a interface o identifica como "Modo demonstração".

## Testes

```bash
cd backend && .venv/bin/python -m pytest -q
```

```bash
cd apps/mobile && npm run typecheck && npm run lint && npm run test:ci && npm run build:web
```

```bash
EMBEDDING_PROVIDER=hashing LLM_PROVIDER=demo backend/.venv/bin/python scripts/run_evaluation.py
```

```bash
backend/.venv/bin/python scripts/verify_project.py
```

Resultados reais registrados: [docs/MATRIZ_TESTES.md](docs/MATRIZ_TESTES.md) e [docs/TESTES_PRODUCAO.md](docs/TESTES_PRODUCAO.md).

## Deploy

- Frontend web na Vercel: [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)
- Backend com disco persistente: [docs/DEPLOY_BACKEND.md](docs/DEPLOY_BACKEND.md)
- Arquitetura de produção, segurança e operação: [docs/PRODUCAO.md](docs/PRODUCAO.md) · [variáveis](docs/VARIAVEIS_AMBIENTE.md) · [rollback](docs/ROLLBACK.md)

**Estado do deploy: preparado para deploy** (configuração e build verificados localmente). Nenhum deploy remoto
foi realizado: exige contas e credenciais da equipe.

## Documentação acadêmica

[Relatório](docs/RELATORIO.md) · [Arquitetura](docs/ARQUITETURA.md) · [Fontes](docs/FONTES.md) ·
[Matriz de testes](docs/MATRIZ_TESTES.md) · [Diário da IA mentora](docs/DIARIO_VALIDACAO_IA.md) ·
[Divisão de tarefas](docs/DIVISAO_TAREFAS.md) · [Roteiro de apresentação](docs/ROTEIRO_APRESENTACAO.md) ·
[Limitações](docs/LIMITACOES.md) · [Segurança](docs/SEGURANCA.md) · [Conformidade com o professor](docs/CONFORMIDADE.md)

UI/UX: [UI_UX](docs/UI_UX.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Fluxos](docs/FLUXOS_UX.md) · [Contrato frontend](docs/CONTRATO_FRONTEND.md)

## Limitações conhecidas (resumo)

- Acervo real ainda não fornecido; resultados atuais referem-se aos documentos **sintéticos**.
- Busca semântica (`fastembed`) não pôde ser executada neste ambiente de desenvolvimento (Hugging Face bloqueado);
  os testes usaram o provedor **lexical** `hashing`. O limiar 0,35 do `fastembed` precisa ser **calibrado**.
- Geração com LLM real não foi executada (sem credencial); o adaptador foi testado com cliente simulado.
- PDFs digitalizados exigem OCR opcional. Sem autenticação de usuários finais: o chat é público na implantação.

Detalhes em [docs/LIMITACOES.md](docs/LIMITACOES.md).

## Solução de problemas

| Sintoma | Causa provável e solução |
|---|---|
| "Backend indisponível" na interface | Backend parado ou `EXPO_PUBLIC_API_URL` incorreta. Teste `curl http://127.0.0.1:8000/api/health`. |
| Celular não conecta | `localhost` aponta para o celular; use o IP do computador e `API_HOST=0.0.0.0`. |
| "Modelo de embeddings indisponível" | Sem acesso ao Hugging Face na 1ª execução. Libere a rede ou use `EMBEDDING_PROVIDER=hashing` (somente testes). |
| "Índice incompatível" | O modelo de embeddings mudou. Use **Reindexar tudo** ou `scripts/ingest_documents.py --reindex`. |
| Documento com "Falha" | Veja o motivo nos detalhes (ex.: PDF sem texto → OCR). |
| 403 ao indexar/enviar | O servidor exige `ADMIN_TOKEN`; informe-o em Configurações. |
| CORS bloqueado no navegador | Inclua a origem do frontend em `CORS_ORIGINS`. |

## Licença

MIT — ver [LICENSE](LICENSE). Os documentos do acervo mantêm suas próprias licenças (ver `docs/FONTES.md`).
