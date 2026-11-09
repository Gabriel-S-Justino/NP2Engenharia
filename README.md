# Acervo IA — consulta documental com fontes verificáveis

Aplicação web e mobile de consulta a leis de trânsito com RAG: recupera evidências dos documentos adicionados pela equipe, responde com um LLM real e apresenta citações verificáveis. Sem evidências suficientes, recusa a pergunta.

## Configuração obrigatória

A aplicação utiliza `LLM_PROVIDER=gemini` por padrão. Configure no servidor:

```dotenv
LLM_PROVIDER=gemini
LLM_API_KEY=<sua chave>
LLM_MODEL=gemini-flash-latest
```

A inicialização é bloqueada sem chave. O gerador extrativo é restrito aos testes automatizados (`APP_ENV=test`); não existe fallback demonstrativo na aplicação. Nunca coloque credenciais em variáveis `EXPO_PUBLIC_*`.

O provedor também aceita `Google`, `google` e `GEMINI`, normalizados para `gemini`. A chave pode estar em `LLM_API_KEY`, `GEMINI_API_KEY` ou `GOOGLE_API_KEY` (nessa ordem de prioridade). Para Anthropic, use `LLM_PROVIDER=anthropic` e um modelo Claude. O adaptador Gemini segue a [API GenerateContent oficial](https://ai.google.dev/api/generate-content).

## Documentos adicionados manualmente

Nenhum comando de instalação ou preparação baixa documentos. Você deve:

1. Colocar seus arquivos PDF/TXT/MD em `Documentos/` ou enviá-los pela biblioteca da aplicação.
2. Preencher os metadados de `Documentos/manifest.json`, seguindo `manifest.example.json`.
3. Executar a indexação na interface ou com `backend/.venv/Scripts/python.exe scripts/ingest_documents.py` (Windows; em Unix, use `.venv/bin/python`).
4. Preparar perguntas e respostas verificadas em `tests/acceptance/matriz_acervo_real.json` e perguntas separadas em `tests/acceptance/calibracao_real.json`. Marcar a matriz como `ready: true` apenas após revisar as fontes.
5. Executar `npm run prepare` para indexar, calibrar e avaliar esse acervo.

A preparação para antes de indexar se a pasta estiver vazia ou a matriz não estiver pronta. O acervo não acompanha este commit; documentos locais e dados derivados não são publicados automaticamente.

O modelo de embeddings semânticos `fastembed` precisa ser obtido na primeira utilização. Isso é independente dos documentos, que são adicionados manualmente.

## Executar

Pré-requisitos: Python 3.11+, Node.js 20+ e npm.

```bash
npm run setup
```

O setup instala dependências e cria `.env` com tokens aleatórios se ele ainda não existir. Um `.env` existente é preservado: revise `LLM_PROVIDER=gemini`, `LLM_API_KEY` e `LLM_MODEL` antes de iniciar.

```bash
npm run dev
```

No Windows também estão disponíveis `.\scripts\setup.ps1`, `.\scripts\dev.ps1` e `.\scripts\prepare.ps1`. Os comandos npm selecionam PowerShell ou Bash conforme o sistema.

Interface: http://localhost:8081. API: http://127.0.0.1:8000/api/docs. Para Android/iOS, configure `EXPO_PUBLIC_API_URL` com a URL pública da API ou o IP do computador; `localhost` no celular aponta para o próprio aparelho.

## Publicar na Vercel

Importe o repositório com a raiz como Root Directory. O `vercel.json` reúne web e API. Configure:

- `DATABASE_URL`: Postgres com pgvector; sem persistência, upload e indexação são bloqueados.
- `ADMIN_TOKEN`: obrigatório para operações administrativas em produção; informe-o em Configurações na interface.
- `LLM_PROVIDER=gemini`, `LLM_API_KEY` e um `LLM_MODEL` disponível na sua conta.
- `CRON_SECRET`: para a chamada agendada de ingestão.

Não copie o `.env` local inteiro para a hospedagem. Deixe `DATA_DIR`, `EMBEDDING_CACHE_DIR`, `APP_ENV` e `EXPO_PUBLIC_API_URL` ausentes para os padrões serverless. Depois do deploy, adicione documentos manualmente e indexe no banco de destino. Banco, índice e calibração locais não são transferidos pelo Git.

Guia: [DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md). Alternativa: [DEPLOY_BACKEND.md](docs/DEPLOY_BACKEND.md).

## Validação

```bash
npm run verify
npm run evaluate:real
```

`verify` executa testes, lint e build. Os testes usam dados sintéticos e clientes simulados isolados para não consumir a API paga; seus resultados não comprovam uma chamada real ao LLM. `evaluate:real` usa o acervo e o provedor configurados, podendo consumir créditos.

A calibração usa parâmetros por chamada, sem expor limiares experimentais às outras instâncias da API. O limiar inicial do `fastembed` é 0,35; calibre com seu próprio acervo.

## Estrutura

- `apps/mobile/`: Expo, React Native, TypeScript e interface web.
- `backend/`: FastAPI, ingestão, recuperação, geração, citações e testes.
- `api/index.py`: entrada da função Python na Vercel.
- `Documentos/`: documentos e metadados fornecidos manualmente.
- `data/`: banco, índices e cache locais, ignorados pelo Git.
- `scripts/`: instalação, execução, ingestão, calibração e verificação.
- `docs/`: arquitetura, segurança, implantação e documentação acadêmica.

Os relatórios históricos de demonstração em `docs/` descrevem execuções anteriores. Não representam validação do LLM real nem do acervo que você ainda vai fornecer.
