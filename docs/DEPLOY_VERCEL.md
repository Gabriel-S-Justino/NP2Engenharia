# Deploy da aplicação completa na Vercel

Toda a aplicação roda em **um único projeto Vercel**:

| Parte | Como roda na Vercel | Arquivo |
|---|---|---|
| Frontend web (Expo + React Native Web) | Site estático (SPA) gerado no build | `vercel.json` → `buildCommand`, `outputDirectory` |
| Backend (FastAPI + RAG) | **Função Python** (`python3.12`) em `/api/*` | `api/index.py`, `requirements.txt`, `.python-version` |
| Banco, índice vetorial e originais | **Postgres com pgvector** (Neon, pelo Marketplace da Vercel) | `DATABASE_URL` |
| Fila de indexação | Chamadas síncronas em lotes + **Vercel Cron** diário | `/api/ingestion/scan`, `/api/cron/ingestion` |

Frontend e API ficam na **mesma origem** (`https://<projeto>.vercel.app` e `…/api`), então não há CORS a configurar
para a web. Detalhes de arquitetura e justificativas: [PRODUCAO.md](PRODUCAO.md).

## 1. Pré-requisitos
- Conta na Vercel com acesso ao repositório do GitHub.
- Banco **Neon** criado pelo Marketplace da Vercel (Storage → Create → Neon). A integração define `DATABASE_URL`
  (conexão *pooled*) no projeto. O plano gratuito do Neon informa 0,5 GB de armazenamento — suficiente para um
  acervo acadêmico; confira limites e preços atuais no painel. A extensão **pgvector** é criada automaticamente
  pela migração (`CREATE EXTENSION IF NOT EXISTS vector`).

## 2. Criar o projeto
1. Vercel → **Add New → Project** → importe o repositório.
2. **Root Directory:** a raiz do repositório (deixe em branco). **Framework Preset:** *Other*.
   Não altere comandos no painel: o `vercel.json` já define instalação (`npm ci --prefix apps/mobile`), build
   (`npm run build:web --prefix apps/mobile`), saída (`apps/mobile/dist`), a função `api/index.py`
   (`maxDuration` 300 s, exclusões do pacote), as reescritas e o cron.
3. **Storage → Connect Database →** selecione o banco Neon e os ambientes (Production e Preview). Para não misturar
   dados, use bancos/branches diferentes para Preview e Production (o Neon permite *branches*).
4. **Settings → Environment Variables** (marque Production e/ou Preview conforme o caso):

| Variável | Obrigatória | Valor |
|---|---|---|
| `DATABASE_URL` | sim | definida pela integração do Neon |
| `ADMIN_TOKEN` | sim | valor longo e aleatório (ex.: `python -c "import secrets;print(secrets.token_urlsafe(32))"`) — protege upload, indexação, exclusão, avaliação e configurações |
| `CRON_SECRET` | recomendada | valor aleatório; a Vercel o envia ao chamar `/api/cron/ingestion` |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` | opcional | `anthropic`, a chave e `claude-opus-5-5`. Sem eles, roda o modo demonstração (extrativo, sem LLM) |
| `EMBEDDING_PROVIDER` | não | padrão `fastembed` (semântico). `hashing` só para demonstração offline |
| `SIMILARITY_THRESHOLD` | recomendada | valor calibrado com o acervo real (ver RELATORIO §8) |

   Não defina `EXPO_PUBLIC_API_URL` para a web (vazio = mesma origem). Detectados automaticamente na Vercel
   (`VERCEL=1`): `APP_ENV=production`, dados temporários em `/tmp`, cache do modelo em `/tmp`, upload máximo de
   4 MB, indexação em lotes de até 240 s, sem remoção automática de documentos ausentes. Inventário completo:
   [VARIAVEIS_AMBIENTE.md](VARIAVEIS_AMBIENTE.md).
5. **Deploy.** Cada push em branch gera um *Preview*; a branch de produção gera o deploy de produção. Recomenda-se
   proteger a branch principal com revisão (ou desativar o deploy automático de produção) para que **nada vá para
   produção sem autorização**.

## 3. Colocar documentos no acervo
Escolha um (ou combine):

**A. Pela interface (até 4 MB por arquivo).** Configurações → informe o `ADMIN_TOKEN` → Documentos → **Enviar
arquivo**. O original é guardado no banco e indexado na mesma requisição.

**B. Pela máquina da equipe, direto no banco (recomendado para PDFs grandes e o acervo inicial).** Na raiz do
repositório, com os documentos em `Documentos/` e a *connection string* do Neon (copie do painel; não cole em
chats nem commits):

```bash
DATABASE_URL='<connection string do Neon>' backend/.venv/bin/python scripts/ingest_documents.py
```

O script extrai, gera embeddings localmente (mesmo modelo da função), grava trechos, vetores **e os originais**
no Postgres. A aplicação na Vercel passa a responder imediatamente e consegue reindexar a partir dos originais.

**C. Versionando documentos públicos em `Documentos/`** (leis, resoluções): ajuste o `.gitignore`; os arquivos
entram no pacote da função e são indexados por **Documentos → Indexar pasta** ou pelo cron diário.

**Indexação em lotes:** cada chamada de indexação na Vercel processa documentos até ~240 s (pelo menos um por
chamada) e deixa o restante **pendente** no banco. A tela Documentos continua chamando automaticamente até
`remaining = 0`; o cron diário também esvazia a fila.

## 4. Primeiro acesso e verificação
1. `https://<projeto>.vercel.app/api/health` → `status: ok`, `storage.backend: postgres`, `storage.persistent: true`.
   Em `embeddings.loaded: false` o modelo ainda não foi carregado (acontece na primeira pergunta/indexação).
2. A **primeira** pergunta ou indexação após um período ocioso baixa o modelo (~120 MB) para `/tmp` e pode levar
   dezenas de segundos ("cold start"); as seguintes são rápidas enquanto a instância estiver ativa.
3. Calibre o limiar com o acervo real (na sua máquina, com a mesma `DATABASE_URL`) e defina `SIMILARITY_THRESHOLD`:

```bash
DATABASE_URL='<connection string>' backend/.venv/bin/python scripts/calibrate_threshold.py --set tests/acceptance/calibracao_real.json --real
```

4. Teste ponta a ponta contra o preview (o script injeta o token só no navegador de teste):

```bash
WEB_URL=https://<preview>.vercel.app ADMIN_TOKEN='<token>' node tests/e2e/web_smoke.mjs
```

Checklist completo: [TESTES_PRODUCAO.md](TESTES_PRODUCAO.md).

## 5. Validar antes de publicar (sem conta)
```bash
npx vercel@latest build
```
Gera `.vercel/output` com o build web e a função Python (exige `.vercel/project.json`; com conta, use
`npx vercel pull` antes). Para uma simulação local com Postgres (web + `/api` na mesma origem, sem lifespan):

```bash
npm run build:web --prefix apps/mobile
```

```bash
VERCEL=1 DATABASE_URL='postgresql://…' ADMIN_TOKEN='token-local' backend/.venv/bin/python scripts/vercel_local.py --port 3000
```

## 6. Deploy pela CLI (alternativa ao Git)
Com login feito por `npx vercel login` (o token fica no seu computador):

```bash
npx vercel link
```

```bash
npx vercel deploy
```

```bash
npx vercel deploy --prod
```

O último comando publica em produção: use somente com autorização do responsável e após validar o preview.

## 7. Apps Android/iOS apontando para a Vercel
```bash
cd apps/mobile && EXPO_PUBLIC_API_URL=https://<projeto>.vercel.app npx expo start
```
Apps nativos não dependem de CORS. Para builds de loja, use EAS com essa variável.

## Problemas comuns
| Sintoma | Causa e solução |
|---|---|
| `/api/health` com "Armazenamento efêmero" e indexação retornando 503 | `DATABASE_URL` ausente no ambiente. Conecte o Neon e faça redeploy. (`ALLOW_EPHEMERAL_STORAGE=true` só para demonstrações descartáveis.) |
| 403 ao enviar/indexar | Informe o `ADMIN_TOKEN` em Configurações (ou defina-o na Vercel e faça redeploy). |
| Primeira resposta demora | Download/carga do modelo no cold start; é esperado. |
| "Modelo de embeddings indisponível" | A função não conseguiu baixar do Hugging Face; tente novamente ou verifique os logs da função. |
| 413 no upload | Limite de 4,5 MB da requisição na Vercel: use a opção B (CLI). |
| "Índice incompatível" | Mudou o modelo de embeddings: Documentos → **Reindexar tudo** (continua em lotes). |
| 404 ao recarregar `/chat` | Reescritas ausentes: confirme que o projeto usa o `vercel.json` da raiz (Root Directory vazio). |
| Build excede limite da função | O pacote medido é ~221 MB; se o plano tiver limite menor, veja PRODUCAO.md → Alternativas. |

Fontes consultadas sobre limites da plataforma (verifique a versão atual): documentação de funções e do runtime
Python da Vercel e FAQ da integração Neon–Vercel.
