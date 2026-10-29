# Procedimento de rollback

## Frontend (Vercel)
1. Vercel → projeto → **Deployments** → escolha o último deploy de produção saudável → **Promote to Production**
   (ou "Instant Rollback"). Não requer novo build.
2. Pela CLI (em `apps/mobile`, autenticado):

```bash
npx vercel rollback
```

3. Verifique o site, a rota `/chat` recarregada e a conexão com o backend.

## Backend (Render; análogo em Railway/Fly.io)
1. Render → serviço → **Events/Deploys** → selecione o deploy anterior → **Rollback** (ou redeploy do commit anterior).
2. O disco `/var/data` **não** é revertido pelo rollback de código. Se a versão nova alterou dados:
   - O esquema SQLite só avança (migrações aditivas). Uma versão antiga pode não reconhecer colunas novas: nesse
     caso restaure o backup do banco feito antes do deploy (ver PRODUCAO.md → Backup).
   - Se o modelo de embeddings mudou, a versão antiga detectará o índice incompatível: execute **Reindexar tudo**.
3. Verifique: `/api/health` ok; `/api/ingestion/status` → `consistent: true` e `compatible: true`; uma pergunta
   conhecida respondida com citação; uma pergunta fora do acervo recusada.

## Antes de todo deploy de produção
- Backup do banco (`sqlite3 /var/data/database/acervo.sqlite3 ".backup /var/data/backup-AAAAMMDD.sqlite3"`).
- Anotar o ID do deploy atual (frontend e backend) para rollback rápido.
- Preview validado com `tests/e2e/web_smoke.mjs` (ver TESTES_PRODUCAO.md).

## Rollback de dados do acervo
- Documento removido por engano de `Documentos/`: o arquivo original é preservado; use reindexação do documento.
- Upload removido por engano: o arquivo é apagado do servidor; reenvie-o.
