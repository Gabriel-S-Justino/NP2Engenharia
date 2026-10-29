# data/

Arquivos **derivados** gerados pelo backend (não versionados):

- `database/acervo.sqlite3` — documentos, trechos, histórico, avaliações e diário da IA mentora.
- `indexes/` — índice vetorial (`faiss.index` + `faiss.meta.json` com a impressão digital do modelo).
- `uploads/` — arquivos enviados pela interface.
- `evaluations/` — relatórios JSON/Markdown de cada execução da matriz de testes.
- `eval_fixtures/` — banco e índice isolados usados pela suíte sintética de testes.

Pode ser apagada com segurança para recomeçar do zero: os documentos originais ficam em `Documentos/`.
Em produção, monte esta pasta em um disco persistente (ver `docs/DEPLOY_BACKEND.md`).
