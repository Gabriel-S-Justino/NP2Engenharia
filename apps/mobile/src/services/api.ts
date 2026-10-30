/**
 * Cliente HTTP centralizado.
 *
 * - Timeout com AbortController e mensagens de erro em português, sem detalhes internos.
 * - Token administrativo (opcional) informado pelo usuário em Configurações e mantido no dispositivo.
 *   Nenhuma chave de LLM existe no frontend: toda geração passa pelo backend.
 */
import type {
  ChatHistory,
  ChatRequest,
  ChatResponse,
  ChunkOut,
  DeleteResult,
  DocumentSummary,
  EvaluationCurrent,
  EvaluationResults,
  EvaluationSummary,
  EvaluationsOverview,
  Health,
  IngestionRun,
  IngestionStatus,
  MentorEntry,
  MentorEntryIn,
  MentorLog,
  Paginated,
  SettingsOut,
  SettingsUpdate,
  SourceDetail,
  Stats,
  UploadResult,
} from '@/types/api';

import { API_BASE_URL, CHAT_TIMEOUT_MS, LONG_OPERATION_TIMEOUT_MS, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from './config';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'aborted';

export class ApiError extends Error {
  constructor(
    message: string,
    public kind: ApiErrorKind,
    public status: number | null = null,
    public code: string | null = null,
    public details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Erros transitórios podem ser repetidos com segurança. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || (this.status !== null && this.status >= 500) || this.status === 429;
  }
}

let adminToken: string | null = null;
let baseUrl = API_BASE_URL;

export function setAdminToken(token: string | null) {
  adminToken = token && token.trim() ? token.trim() : null;
}

export function hasAdminToken() {
  return adminToken !== null;
}

export function getBaseUrl() {
  return baseUrl;
}

/** Usado nos testes e para apontar para outro backend em tempo de execução. */
export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '');
}

const STATUS_MESSAGES: Record<number, string> = {
  403: 'Esta operação exige autorização. Informe o token administrativo em Configurações.',
  404: 'O recurso solicitado não foi encontrado.',
  413: 'O arquivo ou a requisição excede o tamanho permitido.',
  429: 'Muitas requisições em pouco tempo. Aguarde um momento e tente novamente.',
  500: 'O serviço encontrou um erro interno. Tente novamente mais tarde.',
  503: 'O serviço está temporariamente indisponível.',
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  form?: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (adminToken) headers['X-Admin-Token'] = adminToken;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
  } catch {
    if (timedOut) {
      throw new ApiError('O serviço demorou demais para responder. Tente novamente.', 'timeout');
    }
    if (options.signal?.aborted) {
      throw new ApiError('Operação cancelada.', 'aborted');
    }
    throw new ApiError('Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.', 'network');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const body = data as { error?: { code?: string; message?: string; details?: unknown } } | null;
    const message = body?.error?.message ?? STATUS_MESSAGES[response.status] ?? 'Não foi possível concluir a operação.';
    throw new ApiError(message, 'http', response.status, body?.error?.code ?? null, body?.error?.details ?? null);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export type UploadableFile = { uri: string; name: string; mimeType?: string | null; file?: Blob | null };

export const api = {
  health: () => request<Health>('/api/health', { timeoutMs: 8000 }),
  stats: () => request<Stats>('/api/stats'),

  documents: (params: { page?: number; pageSize?: number; status?: string; search?: string; fileType?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('page_size', String(params.pageSize ?? 50));
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (params.fileType) qs.set('file_type', params.fileType);
    if (params.sort) qs.set('sort', params.sort);
    return request<Paginated<DocumentSummary>>(`/api/documents?${qs.toString()}`);
  },
  document: (id: string) => request<DocumentSummary>(`/api/documents/${encodeURIComponent(id)}`),
  documentChunks: (id: string, page = 1, pageSize = 20) =>
    request<Paginated<ChunkOut>>(`/api/documents/${encodeURIComponent(id)}/chunks?page=${page}&page_size=${pageSize}`),
  deleteDocument: (id: string) => request<DeleteResult>(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadDocument: async (file: UploadableFile) => {
    const form = new FormData();
    if (file.file) {
      form.append('file', file.file, file.name);
    } else {
      // React Native (Android/iOS): objeto { uri, name, type } é convertido em multipart pelo runtime.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    }
    return request<UploadResult>('/api/documents/upload', { method: 'POST', form, timeoutMs: UPLOAD_TIMEOUT_MS });
  },
  source: (id: string) => request<SourceDetail>(`/api/sources/${encodeURIComponent(id)}`),

  scan: () => request<IngestionRun>('/api/ingestion/scan', { method: 'POST', timeoutMs: LONG_OPERATION_TIMEOUT_MS }),
  reindex: (documentIds?: string[]) =>
    request<IngestionRun>('/api/ingestion/reindex', {
      method: 'POST',
      body: documentIds ? { document_ids: documentIds } : {},
      timeoutMs: LONG_OPERATION_TIMEOUT_MS,
    }),
  ingestionStatus: () => request<IngestionStatus>('/api/ingestion/status'),

  chat: (body: ChatRequest, signal?: AbortSignal) =>
    request<ChatResponse>('/api/chat', { method: 'POST', body, timeoutMs: CHAT_TIMEOUT_MS, signal }),
  chatHistory: (conversationId: string) => request<ChatHistory>(`/api/chat/history/${encodeURIComponent(conversationId)}`),
  clearChat: (conversationId: string) =>
    request<{ removed: number }>(`/api/chat/history/${encodeURIComponent(conversationId)}`, { method: 'DELETE' }),

  evaluations: () => request<EvaluationsOverview>('/api/evaluations'),
  runEvaluation: (suite: string) =>
    request<EvaluationCurrent>('/api/evaluations/run', { method: 'POST', body: { suite }, timeoutMs: LONG_OPERATION_TIMEOUT_MS }),
  evaluationRun: (runId: string) =>
    request<{ id: string; status: string; error_message: string | null }>(`/api/evaluations/runs/${encodeURIComponent(runId)}`),
  evaluationResults: (runId?: string, suite?: string) => {
    const qs = new URLSearchParams();
    if (runId) qs.set('run_id', runId);
    if (suite) qs.set('suite', suite);
    return request<EvaluationResults>(`/api/evaluations/results${qs.toString() ? `?${qs}` : ''}`);
  },
  registerAdjustment: (runId: string, caseId: string, adjustment: string) =>
    request<EvaluationSummary>(
      `/api/evaluations/results/${encodeURIComponent(runId)}/cases/${encodeURIComponent(caseId)}/adjustment`,
      { method: 'POST', body: { adjustment } },
    ),

  settings: () => request<SettingsOut>('/api/settings'),
  updateSettings: (body: SettingsUpdate) =>
    request<SettingsOut>('/api/settings', { method: 'PATCH', body, timeoutMs: LONG_OPERATION_TIMEOUT_MS }),

  mentorLog: () => request<MentorLog>('/api/mentor-log'),
  addMentorEntry: (entry: MentorEntryIn) => request<MentorEntry>('/api/mentor-log', { method: 'POST', body: entry }),
};
