# data/

Arquivos **derivados** gerados pelo backend (não versionados):

- `database/acervo.sqlite3` — documentos, trechos, arquivos enviados, histórico, avaliações e diário da IA mentora.
- `indexes/` — índice vetorial (`faiss.index` + `faiss.meta.json` com a impressão digital do modelo).
- `evaluations/` — relatórios JSON/Markdown de cada execução da matriz de testes.
- `eval_fixtures/` — banco e índice isolados usados pela suíte sintética de testes.

Pode ser apagada para recomeçar do zero: os documentos de `Documentos/` permanecem, mas os arquivos enviados
pela interface (guardados no banco) são perdidos.
Na Vercel esta pasta fica em `/tmp` e é só rascunho: os dados persistentes vão para o Postgres (`DATABASE_URL`).
No contêiner alternativo, monte-a em um disco persistente (ver `docs/DEPLOY_BACKEND.md`).
