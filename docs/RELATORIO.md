# Relatório técnico — Acervo IA

**Disciplina:** Engenharia de Inteligência Artificial
**Equipe:** _[nomes dos cinco integrantes — a preencher pela equipe]_
**Data desta versão:** 29/10/2026

> Os campos marcados como **[a preencher]** dependem de dados que só a equipe pode fornecer (documentos reais,
> validações humanas, interações com a IA mentora). Nenhum resultado foi inventado: os números abaixo vêm de
> execuções registradas em `docs/resultados/`.

## 1. Introdução

O Acervo IA é um assistente de consulta documental sobre leis de trânsito. Ele combina recuperação semântica de
trechos (busca vetorial) com geração de texto, e só apresenta respostas sustentadas por trechos dos documentos
selecionados pela equipe, sempre com a fonte (documento, página, seção e trecho). Quando não há evidência, o
sistema informa isso em vez de responder.

## 2. Problema

Falta de conhecimento sobre as leis de trânsito e dificuldade de acesso a ferramentas educativas. A legislação
(Código de Trânsito Brasileiro, resoluções do CONTRAN, manuais oficiais) é extensa, técnica e distribuída em vários
documentos. Um iniciante tem dificuldade em localizar a regra aplicável à sua dúvida; chatbots genéricos podem
responder com segurança aparente e informação errada ou desatualizada.

## 3. Justificativa e adequação do RAG

- **Respostas dependem de um corpus específico e mutável:** RAG ancora a resposta no texto vigente do acervo, sem
  re-treinar modelos; atualizar a lei = substituir o PDF e reindexar.
- **Vocabulário do usuário ≠ vocabulário da norma:** "posso levar meu filho no banco da frente?" vs. "dispositivo
  de retenção". Embeddings semânticos recuperam por significado.
- **Necessidade de verificação:** em tema normativo, o usuário precisa conferir a fonte. RAG permite citações
  rastreáveis até a página.
- **Quando uma busca convencional basta:** quando o usuário conhece o termo ou o artigo exato ("Art. 165",
  "Resolução 819"), quando quer o documento inteiro, ou para listas e índices. O RAG não substitui a leitura da
  norma em casos complexos.

## 4. Objetivos

**Geral:** desenvolver uma aplicação RAG funcional, segura e avaliada, que responda perguntas sobre leis de trânsito
com base em documentos validados pela equipe.

**Específicos:** (1) ingerir PDFs/TXT preservando página e seção; (2) indexar com embeddings semânticos e busca
vetorial persistente; (3) gerar respostas com citações verificáveis; (4) recusar perguntas sem evidência ou fora
do escopo; (5) resistir a instruções maliciosas; (6) avaliar com matriz 6/2/2 e meta de 80%; (7) oferecer interface
web/mobile acessível; (8) documentar decisões, limitações e validação com IA mentora; (9) preparar a implantação.

## 5. Público-alvo

Motoristas iniciantes (candidatos à habilitação e recém-habilitados) e pessoas interessadas em aprender sobre as
leis de trânsito. Implicações de projeto: linguagem simples, uso em celular, transparência sobre limites, e
nenhuma pretensão de aconselhamento jurídico.

## 6. Metodologia

1. Definição do problema e do escopo; critérios do professor convertidos em requisitos rastreáveis
   ([CONFORMIDADE.md](CONFORMIDADE.md)).
2. Construção do pipeline com **documentos sintéticos de teste**, para validar o software antes de o acervo real
   estar pronto, mantendo-os isolados e identificados como fictícios.
3. Testes automatizados em três níveis: unitário/integração (Pytest e Jest), matriz de avaliação do RAG e teste
   ponta a ponta da interface web (Playwright).
4. Ciclo falha → causa → ajuste → nova execução, registrado em [MATRIZ_TESTES.md](MATRIZ_TESTES.md).
5. Calibração do limiar com conjunto de perguntas **separado** da matriz.
6. Validação com IA mentora registrada no [diário](DIARIO_VALIDACAO_IA.md) **[a realizar pela equipe]**.

## 7. Base documental

**[a preencher pela equipe]** — o requisito é de no mínimo 10 documentos ou 25 páginas úteis, selecionados e
validados pela equipe, registrados em [FONTES.md](FONTES.md) e `Documentos/manifest.json`, com o inventário gerado
por `scripts/inventario_documentos.py`. Até esta versão **nenhum documento real foi fornecido**; todos os
resultados abaixo referem-se aos documentos sintéticos (3 arquivos fictícios, 7 páginas).

## 8. Arquitetura e implementação

Ver [ARQUITETURA.md](ARQUITETURA.md). Resumo: frontend Expo (web/Android/iOS) → API FastAPI → pipeline RAG
(ingestão, embeddings, busca vetorial, recuperação, avaliação de evidência, geração, citações) → banco relacional +
índice vetorial. Localmente: SQLite + FAISS em disco. Em produção, **toda a aplicação roda na Vercel** (site
estático + função Python) com **Postgres Neon + pgvector**, originais guardados no banco e indexação em lotes
([PRODUCAO.md](PRODUCAO.md)). Parâmetros:

| Parâmetro | Valor | Justificativa / calibração |
|---|---|---|
| Unidade de chunk | caracteres | independente do tokenizador; fácil de explicar |
| Tamanho do chunk | 800 | ~1 artigo de lei com parágrafos; cabe vários trechos no contexto |
| Sobreposição | 120 | evita perder frases cortadas na fronteira |
| Regras extras | chunks por página e quebra em títulos | página correta na citação; seções não se misturam (falha A6) |
| Top-k | 5 | contexto suficiente sem diluir; ajustável na interface |
| Métrica | similaridade de cosseno | vetores normalizados; −1 a 1 |
| Limiar (`hashing`) | 0,15 | calibrado: separa 0,105 (não respondíveis) de 0,176 (respondíveis) |
| Limiar (`fastembed`) | 0,35 (inicial) | **não calibrado** — recalibrar com o acervo real |
| Cobertura mínima de termos | 0,5 (modo demo) | ponderada por IDF; termos interrogativos ignorados |
| Filtros | documento, tipo de arquivo, assunto | via `filters` em `POST /api/chat` |
| Modelo de embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (fastembed/ONNX) | multilíngue, local, sem chave |
| Modelo de geração | `claude-opus-5-5` (Anthropic), esforço `low` | qualidade em PT-BR; custo controlado |

## 9. Estratégia de chunking, embeddings, recuperação e geração

- **Chunking:** texto limpo de cada página dividido em parágrafos → frases → cortes por palavra; janelas até 800
  caracteres com 120 de sobreposição; título detectado (Art., CAPÍTULO, SEÇÃO, linhas em maiúsculas) abre novo
  trecho e define a seção; trecho final curto é unido ao anterior.
- **Embeddings:** mesmo provedor/modelo para documentos e perguntas; a "impressão digital" do modelo é salva com o
  índice; índice incompatível não é reutilizado.
- **Recuperação:** busca exata no FAISS, filtros, limiar; candidatos abaixo do limiar ou fora do top-k são exibidos
  no painel de evidências com o motivo (observabilidade).
- **Avaliação da evidência:** sem trechos acima do limiar → recusa; no modo extrativo, cobertura IDF insuficiente →
  recusa; similaridade próxima do limiar → "evidência fraca"; valores numéricos divergentes entre documentos →
  "fontes divergentes".
- **Geração:** prompt de sistema exigido pelo enunciado (em `services/generation.py`), contexto em tags
  `<fonte id="F1">` com escape, citação obrigatória `[F1]`, prefixos `SEM_EVIDENCIA:`/`FORA_DO_ESCOPO:`.
  O backend valida e reconstrói as citações. Modo demonstração: seleção extrativa determinística de frases.

## 10. Testes e métricas

| Conjunto | Quantidade | Resultado | Evidência |
|---|---|---|---|
| Backend (Pytest) | 82 testes (75 SQLite + 7 Postgres/pgvector) | 82 aprovados | `cd backend && TEST_DATABASE_URL=… pytest -q` |
| Frontend (Jest + Testing Library) | 59 testes | 59 aprovados | `npm run test:ci` |
| Matriz RAG sintética (execução final) | 10 casos (6/2/2) | 10/10 = 100% | `docs/resultados/ultima_execucao_fixtures.md` |
| Histórico da matriz | 4 execuções | 80% → 100% → 100% → 100% | [MATRIZ_TESTES.md](MATRIZ_TESTES.md) |
| Calibração ponta a ponta | 18 perguntas | 17/18 = 94% | `docs/resultados/calibracao_hashing_fixtures.md` |
| E2E web (Playwright, build de produção) | 11 etapas × 2 modos | 11/11 local e 11/11 Vercel simulada | `tests/e2e/web_smoke.mjs`, capturas em `docs/capturas/` |
| Deploy Vercel (sem conta) | `vercel build` + handler oficial | aprovado | [TESTES_PRODUCAO.md](TESTES_PRODUCAO.md) |

Métricas da execução final: Recall@5 = 1,0; MRR = 1,0; recusa quando esperado = 100%; citações válidas = 100%.
Métricas operacionais (latência de recuperação/geração/total, fontes por resposta, taxa de citações válidas, taxa
de sucesso da ingestão) são medidas em produção e exibidas no Dashboard. **[a preencher com o acervo real]**

## 11. Segurança e ética

Ver [SEGURANCA.md](SEGURANCA.md): recusa segura, bloqueio de injeção na pergunta, trechos maliciosos tratados como
dados (caso A6), validação de citações, remoção de segredos, uploads validados, token administrativo, CORS,
limites, retenção do histórico e aviso sobre envio de trechos a provedor externo.

## 12. Resultados obtidos

- Pipeline completo funcionando de ponta a ponta na web (build de produção) com backend real.
- Matriz sintética: 100% na execução final, após duas correções motivadas por falhas reais (80% na 1ª execução).
- Resultados com o acervo real, embeddings semânticos e LLM: **[a preencher — dependem da equipe e de
  credenciais]**.

## 13. Limitações

Ver [LIMITACOES.md](LIMITACOES.md). Principais: acervo real pendente; `fastembed` e LLM não executados neste
ambiente; matriz pequena; heurísticas (injeção, divergência, cobertura) podem falhar; PDFs digitalizados exigem OCR.

## 14. Conclusão

O projeto entrega uma aplicação RAG observável e testável, cujo comportamento central — responder com fontes e
recusar sem evidência — foi verificado automaticamente. O valor educativo real depende agora da curadoria do
acervo pela equipe, da calibração com o modelo semântico e da validação humana das respostas. **[a complementar
pela equipe após a avaliação com o acervo real]**

## 15. Referências

- LEWIS, P. et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. *NeurIPS*, 2020.
- REIMERS, N.; GUREVYCH, I. Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks. *EMNLP*, 2019.
- JOHNSON, J.; DOUZE, M.; JÉGOU, H. Billion-scale similarity search with GPUs (FAISS). *IEEE Trans. Big Data*, 2019.
- W3C. Web Content Accessibility Guidelines (WCAG) 2.2, 2023.
- OWASP. Top 10 for Large Language Model Applications (LLM01: Prompt Injection).
- Documentação: FastAPI, Pydantic, FAISS, fastembed, Expo/Expo Router, React Native, Anthropic API.
- Fontes do acervo: ver [FONTES.md](FONTES.md) **[a preencher]**.
