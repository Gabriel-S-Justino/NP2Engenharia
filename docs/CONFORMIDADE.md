# Matriz de conformidade com o guia do professor

Estados: **Atendido** (implementado e verificado) · **Parcial** (implementado, falta etapa da equipe ou verificação
externa) · **Bloqueado** (depende de credencial/serviço indisponível) · **Não atendido**.

## Critérios de avaliação (5,00 pontos)

| Critério | Peso | Evidência | Teste/verificação | Estado |
|---|---|---|---|---|
| Problema, público-alvo e adequação do RAG | 0,75 | README; RELATORIO §2–5 (inclui quando busca convencional basta) | Revisão documental | **Atendido** (a equipe deve revisar o texto) |
| Funcionamento técnico do pipeline RAG | 1,50 | `backend/app/services/*`; ARQUITETURA.md | 73 testes backend; E2E 11/11; matriz 10/10 | **Atendido** com documentos sintéticos e embeddings lexicais; **Parcial** quanto a embeddings semânticos e LLM real (bloqueados neste ambiente) |
| Fontes, citações e segurança | 1,00 | `citations.py`, `safety.py`, SEGURANCA.md, FONTES.md | testes de citação inventada, injeção, segredos, uploads | **Parcial**: citações e segurança atendidas; **fontes reais pendentes da equipe** |
| Testes, métricas e análise de falhas | 0,75 | MATRIZ_TESTES.md; `docs/resultados/` | 4 execuções reais (80% → 100%) com causa e ajuste | **Atendido** para a suíte sintética; suíte real pendente |
| Validação com IA mentora | 0,75 | DIARIO_VALIDACAO_IA.md; tela/endpoint `/api/mentor-log` | `test_mentor_log_roundtrip` | **Parcial**: estrutura pronta; **nenhuma interação real registrada** |
| Documentação e apresentação | 0,25 | README, RELATORIO, ROTEIRO_APRESENTACAO, docs/* | `verify_project.py` (arquivos obrigatórios) | **Parcial**: campos [a preencher] com nomes, fontes e resultados reais |

## Requisitos do guia

| Requisito | Evidência | Estado |
|---|---|---|
| Problema, público e adequação do RAG justificados | RELATORIO §2–3 | Atendido |
| Base documental ≥ 10 documentos ou 25 páginas, validada pela equipe | `Documentos/` (vazio), `scripts/inventario_documentos.py`, checklist em `Documentos/README.md` | **Não atendido — depende da equipe** |
| Metadados (título, URL, página, seção, assunto, licença; autoria, data, versão) | `manifest.json`, `SourceMetadata`, tela Fontes ("Não informado" quando ausente) | Atendido (software); preenchimento pendente |
| Registro de lacunas e fontes frágeis | FONTES.md (seções prontas) | Parcial |
| Pipeline observável (documentos → … → recusa segura) | painel de evidências com candidatos e motivos; `/api/ingestion/status`; logs JSON | Atendido |
| Relatório explicita top-k, filtros, limiar, embeddings e geração com justificativas | RELATORIO §8–9 | Atendido (limiar do fastembed a recalibrar) |
| Matriz ≥ 10 perguntas, exatamente 6/2/2 | `matriz_fixtures.json`; `matriz_acervo_real.json` (modelo) | Atendido (sintética); real pendente |
| Meta ≥ 80% calculada sobre testes executados | `evaluation.summarize`; `test_evaluation_run_and_results` | Atendido |
| Causa, ajuste e nova execução das falhas | MATRIZ_TESTES §3; ajustes registráveis pela interface | Atendido |
| Diário da IA mentora (prompt, resposta, decisão, alteração, evidência) | DIARIO_VALIDACAO_IA.md + formulário | Parcial (sem registros reais) |
| Segurança, privacidade, ética, instruções maliciosas, limites, evidência insuficiente | SEGURANCA.md, LIMITACOES.md | Atendido |
| Aplicação funcional, código organizado, README, relatório, matriz, diário, apresentação ≤ 7 min | repositório; ROTEIRO_APRESENTACAO.md | Atendido/Parcial (itens da equipe) |
| Equipe de 5, divisão de tarefas, cada integrante explica algo | DIVISAO_TAREFAS.md (sem nomes inventados) | Parcial |

## Requisitos técnicos e de produto (resumo)

| Requisito | Estado | Observação |
|---|---|---|
| Stack obrigatória (RN, Expo, TS, Expo Router, RN Web, Python, FastAPI, Pydantic, Pytest, embeddings, busca vetorial) | Atendido | |
| Pasta `Documentos/` com instruções; originais nunca alterados | Atendido | testes de hash antes/depois |
| PDF/TXT, páginas e metadados, SHA-256, duplicatas, falhas isoladas, idempotência | Atendido | |
| Chunks configuráveis, embeddings abstraídos, FAISS persistente e seguro, incompatibilidade detectada | Atendido | |
| Recuperação com limiar, métrica, filtros, latência; recusa sem evidência | Atendido | |
| Geração por LLM configurável + modo demonstração identificado | Parcial | LLM não executado (sem chave) |
| Citações verificáveis e validadas | Atendido | |
| 17 endpoints exigidos + OpenAPI | Atendido | + chunks, histórico, ajustes, estado de execução |
| Telas: Dashboard, Chat, Biblioteca, Fontes, Laboratório, Configurações (+ Diário) | Atendido | E2E 11/11 |
| Design system, responsividade, acessibilidade básica, estados | Atendido | leitores de tela reais não testados |
| Web / Android / iOS | Parcial | web testada; Android/iOS compatíveis via Expo, não testados em dispositivo |
| Testes automatizados backend e frontend | Atendido | 73 + 55 |
| Scripts Unix/PowerShell, Docker | Parcial | scripts `.sh` executados; `.ps1` não executados (sem Windows); imagem Docker não construída (Docker Hub 429) |
| Deploy: frontend Vercel, backend persistente, CI, rollback, variáveis | Preparado | nenhum deploy remoto (sem contas/autorização) |
| Nenhuma credencial no repositório | Atendido | `.env` ignorado; CI verifica o bundle |

## Pendências que dependem da equipe
1. Reunir e validar o acervo real; preencher `manifest.json` e FONTES.md; rodar o inventário.
2. Rodar com `fastembed` (internet na 1ª execução), recalibrar o limiar e preencher/executar a matriz real.
3. Configurar `LLM_API_KEY` no servidor e reavaliar com leitura humana das respostas.
4. Realizar e registrar as validações com a IA mentora.
5. Preencher nomes/contribuições, testar no celular (Expo Go) e publicar preview/produção com autorização.
