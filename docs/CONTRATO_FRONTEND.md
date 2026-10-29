# Contrato frontend ↔ backend

Fonte da verdade: schemas Pydantic em `backend/app/schemas/models.py` (OpenAPI em `/openapi.json` e `/docs`).
Espelho TypeScript: `apps/mobile/src/types/api.ts`. Cliente: `apps/mobile/src/services/api.ts`.
O contrato foi **validado com o backend real** pelo teste E2E (`tests/e2e/web_smoke.mjs`); não há dados mockados
na aplicação (mocks existem apenas nos testes automatizados).

## Convenções
- JSON UTF-8; datas ISO 8601 (UTC); `null` = não informado (nunca string vazia).
- Erros: `{"error": {"code": "...", "message": "...", "details"?: ...}}` — `message` é pública e em português.
- Operações administrativas enviam `X-Admin-Token` quando o servidor exige (`settings.admin_required`).
- Timeouts do cliente: 20 s (padrão), 90 s (chat), 120 s (upload). `ApiError.kind`: `network | timeout | http | aborted`.

## Endpoints

| Método e caminho | Requisição | Resposta | Admin |
|---|---|---|---|
| GET `/api/health` | — | `Health` | não |
| GET `/api/stats` | — | `Stats` | não |
| GET `/api/documents` | `page, page_size, status, search, file_type, sort` | `Paginated<DocumentSummary>` | não |
| POST `/api/documents/upload` | multipart `file` | `UploadResult` (201) | sim |
| GET `/api/documents/{id}` | — | `DocumentSummary` | não |
| GET `/api/documents/{id}/chunks` | `page, page_size` | `Paginated<ChunkOut>` | não |
| DELETE `/api/documents/{id}` | — | `DeleteResult` | sim |
| GET `/api/sources/{source_id}` | — | `SourceDetail` | não |
| POST `/api/ingestion/scan` | `?wait=bool` | `IngestionRun` (202) | sim |
| POST `/api/ingestion/reindex` | `{document_ids?: string[]}` | `IngestionRun` (202) | sim |
| GET `/api/ingestion/status` | — | `IngestionStatus` | não |
| POST `/api/chat` | `ChatRequest` | `ChatResponse` | não (limite/minuto) |
| GET/DELETE `/api/chat/history/{conversation_id}` | — | `ChatHistory` / `{removed}` | não |
| GET `/api/evaluations` | — | `{suites, runs, current}` | não |
| POST `/api/evaluations/run` | `{suite}` | estado da execução (202) | sim |
| GET `/api/evaluations/runs/{id}` | — | `{id, status, error_message}` | não |
| GET `/api/evaluations/results` | `run_id?` ou `suite?` | `EvaluationResults` (404 = ainda não avaliado) | não |
| POST `/api/evaluations/results/{run}/cases/{case}/adjustment` | `{adjustment}` | `EvaluationSummary` | sim |
| GET `/api/settings` | — | `SettingsOut` (sem segredos) | não |
| PATCH `/api/settings` | `SettingsUpdate` | `SettingsOut` (409 se faltar `confirm_reindex`) | sim |
| GET/POST `/api/mentor-log` | `MentorEntryIn` | `MentorLog` / `MentorEntry` (201) | POST sim |

## Tipos principais (resumo)
```ts
type ChatStatus = 'answered' | 'insufficient_evidence' | 'out_of_scope' | 'no_documents' | 'blocked' | 'provider_error' | 'index_unavailable';
type EvidenceStatus = 'sufficient' | 'weak' | 'conflicting' | 'insufficient' | 'none';

type Citation = {
  label: string;            // F1 — usado no texto da resposta
  source_id: string;        // ID estável do trecho → GET /api/sources/{source_id}
  document_id: string; document_title: string; filename: string;
  page: number | null; section: string | null; excerpt: string;
  relevance: number;        // similaridade de cosseno; NÃO é probabilidade
  url: string | null; license: string | null; author: string | null; institution: string | null;
  published_date: string | null; version: string | null; origin: string;
  suspicious: boolean;      // trecho com formato de instrução (tratado como dado)
  cited_in_answer: boolean; // false = recuperado mas não citado
};

type ChatResponse = {
  interaction_id: string; conversation_id: string; question: string;
  status: ChatStatus; evidence_status: EvidenceStatus;
  answer: string | null;    // null em recusas e falhas
  notice: string | null;    // aviso a exibir ao usuário
  citations: Citation[]; citations_valid: boolean; warnings: string[];
  retrieval: RetrievalInfo | null;  // top_k, limiar, métrica, candidatos e motivos
  generation: { provider: string; model: string; mode: 'demo_extractive' | 'llm' | 'none'; is_llm: boolean };
  latency: { retrieval_ms: number | null; generation_ms: number | null; total_ms: number };
  created_at: string;
};
```
Campos completos de `DocumentSummary`, `Stats`, `Health`, `SettingsOut`, `EvaluationResults` etc. em `types/api.ts`.

## Estados de carregamento e erro no cliente
- `useAsync`: `{data, error, loading, reload}`; ignora respostas fora de ordem.
- `useIngestion`: polling de 1,5 s enquanto `running`.
- Erros HTTP → mensagem do backend; rede/timeout → mensagem padrão + opção de repetir quando `retryable`.

## Dependências do backend e pendências
- O frontend depende de `EXPO_PUBLIC_API_URL` (pública) e do CORS do backend incluir a origem da web.
- Pendências: nenhuma divergência de contrato conhecida. Mudanças futuras no backend exigem atualizar `types/api.ts`
  (não há geração automática de tipos a partir do OpenAPI — melhoria possível).
