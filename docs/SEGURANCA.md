# Segurança, privacidade e ética

> Nenhum sistema é totalmente seguro. Este documento descreve as proteções **implementadas e testadas** e os
> **riscos residuais**.

## Proteções implementadas

| Risco | Proteção | Onde | Teste |
|---|---|---|---|
| Resposta inventada (alucinação) | Limiar de similaridade + cobertura de termos + instrução `SEM_EVIDENCIA` ao LLM; recusa sem citações | `pipeline.py`, `evidence.py`, `generation.py` | `test_absent_and_out_of_scope_are_refused`, casos B1/B2/C1 |
| Citação inventada | Citações montadas pelo backend; rótulos fora do conjunto recuperado são removidos e `citations_valid=false` | `citations.py` | `test_invented_citation_is_removed_and_flagged` |
| Instrução maliciosa na pergunta | Detecção de padrões PT/EN; a pergunta não chega ao modelo | `safety.py` | caso C2, `test_malicious_question_is_blocked` |
| Instrução maliciosa no documento | Trechos marcados `suspicious`; contexto em tags com escape; frases de instrução excluídas do modo extrativo; prompt declara documentos como dados | `ingestion.py`, `generation.py` | caso A6, `test_malicious_document_content_is_not_obeyed` |
| Vazamento de segredos | Segredos nunca entram no contexto; resposta passa por remoção de `LLM_API_KEY`/`ADMIN_TOKEN` | `safety.scrub_secrets` | `test_secret_is_scrubbed_from_answer` |
| Chave no frontend | Somente variáveis `EXPO_PUBLIC_*` (URL) no bundle; CI verifica padrão de chave no `dist/` | `ci.yml` | verificação de bundle |
| Path traversal | Nome de arquivo saneado; `safe_child` garante caminho dentro da pasta; IDs codificados na URL | `security.py`, `api.ts` | `test_upload_txt_then_delete_removes_file`, `api.test.ts` |
| Upload perigoso | Extensão permitida + assinatura real (`%PDF-`), texto sem bytes nulos, limite de tamanho, nada é executado | `routes.py` | `test_upload_rejections`, `test_upload_size_limit` |
| Operações administrativas abertas | `X-Admin-Token` comparado em tempo constante; em produção sem token, bloqueadas | `security.require_admin` | `test_admin_token_protects_mutations`, `test_production_without_admin_token_blocks_mutations` |
| Abuso/custos | Limite de perguntas por minuto por cliente; tamanho máximo de pergunta e de corpo | `security.RateLimiter`, middleware | `test_rate_limit`, `test_errors_do_not_leak_internals` |
| Origem não autorizada | CORS por lista; `*` proibido em produção | `main.py`, `config.py` | `test_cors_restricted`, `test_config_rejects_wildcard_cors_in_production` |
| Vazamento de detalhes internos | Erros padronizados, sem stack trace/caminhos; cabeçalhos `nosniff`, `DENY`, `no-referrer` | `errors.py`, `main.py` | `test_errors_do_not_leak_internals` |
| Desserialização insegura | FAISS `write_index/read_index` e NumPy `allow_pickle=False`; nenhum pickle | `vector_store.py` | `test_vector_store_persist_load_remove` |
| Documentos originais alterados | Sistema só lê `Documentos/`; exclusão retira do índice e preserva o arquivo | `ingestion.py`, `routes.py` | `test_scan_indexes_and_is_idempotent`, `test_delete_document_from_documentos_preserves_original` |

## Privacidade

- Logs registram **hash e tamanho** da pergunta, não o texto. O histórico de chat fica no SQLite e é expurgado
  após `HISTORY_RETENTION_DAYS` (padrão 30); o usuário pode limpar a conversa a qualquer momento.
- Com `LLM_PROVIDER=anthropic`, a pergunta e os trechos recuperados são enviados à API externa. **Não indexe
  documentos confidenciais ou com dados pessoais sem autorização.** No modo demonstração nada sai do servidor.
- Embeddings são calculados localmente (fastembed): o conteúdo dos documentos não é enviado para gerar vetores.
- A API não é exposta à rede por padrão (`API_HOST=127.0.0.1`; Docker publica só em `127.0.0.1`).

## Ética e limites

- O sistema é **educativo**; não substitui a legislação oficial, orientação jurídica nem o órgão de trânsito.
  A interface lembra que uma citação não garante que a resposta esteja correta.
- Normas mudam: fontes desatualizadas devem ser sinalizadas em `docs/FONTES.md` e no manifesto.
- Divergências entre fontes são sinalizadas (heurística numérica + instrução ao LLM), não resolvidas
  automaticamente.

## Riscos residuais

- Detecção de injeção é heurística (padrões); variações criativas podem passar. Mitigam: separação estrutural,
  validação de citações e ausência de segredos no contexto.
- Não há autenticação de usuários finais; o chat é público na implantação (mitigado por limite de requisições).
- Limite de requisições é em memória (uma instância); atrás de proxy usa `X-Forwarded-For`, que pode ser forjado
  se o backend for exposto sem o proxy da plataforma.
- O token administrativo fica salvo no dispositivo do administrador (AsyncStorage/localStorage).
