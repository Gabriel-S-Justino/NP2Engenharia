# Procedimento de rollback

A aplicação inteira (web + função Python) é um único deploy da Vercel; os dados ficam no Neon Postgres.
Reverter o código **não** reverte os dados, e vice-versa.

## Código (Vercel)
1. Vercel → projeto → **Deployments** → escolha o último deploy de produção saudável → **Promote to Production**
   (ou *Instant Rollback*). Não requer novo build; web e API voltam juntas.
2. Pela CLI (autenticado, na raiz do repositório):

```bash
npx vercel rollback
```

3. Verifique: `/api/health` (`status: ok`, `storage.persistent: true`), recarregar `/chat`, uma pergunta conhecida
   respondida com citação e uma pergunta fora do acervo recusada.

## Dados (Neon Postgres)
- **Antes de todo deploy que mude o esquema ou o modelo de embeddings:** crie um *branch* de backup no Neon
  (painel → Branches → Create branch a partir de `main`) ou exporte:

```bash
pg_dump "$DATABASE_URL" -Fc -f acervo-AAAAMMDD.dump
```

- **Restaurar:** use a restauração por ponto no tempo do Neon (dentro da janela de retenção do plano) ou:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" acervo-AAAAMMDD.dump
```

- As migrações só **adicionam** estruturas. Se uma versão antiga não reconhecer dados novos, restaure o backup
  feito antes do deploy.
- Se o modelo de embeddings mudou entre versões, a versão em uso detecta o índice incompatível e pede
  **Reindexar tudo** (continua em lotes a partir dos originais guardados no banco).

## Dados do acervo
- Documento removido por engano: uploads são apagados do banco (reenvie o arquivo); documentos de `Documentos/`
  ficam "Fora do índice" com o original preservado e voltam com a reindexação do documento.

## Checklist antes de promover para produção
- [ ] Preview validado com `tests/e2e/web_smoke.mjs` (ver TESTES_PRODUCAO.md).
- [ ] Backup/branch do banco criado.
- [ ] ID do deploy de produção atual anotado.
- [ ] Autorização do responsável registrada.
