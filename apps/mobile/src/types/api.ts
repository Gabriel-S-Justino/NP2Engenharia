/**
 * Tipos do contrato com o backend (espelham backend/app/schemas/models.py).
 * Documentação: docs/CONTRATO_FRONTEND.md. Qualquer mudança no backend deve ser refletida aqui.
 */

export type DocumentStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'excluded';
export type ChatStatus =
  | 'answered'
  | 'insufficient_evidence'
  | 'out_of_scope'
  | 'no_documents'
  | 'blocked'
  | 'provider_error'
  | 'index_unavailable';
export type EvidenceStatus = 'sufficient' | 'weak' | 'conflicting' | 'insufficient' | 'none';

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

export type SourceMetadata = {
  title: string | null;
  author: string | null;
  institution: string | null;
  published_date: string | null;
  version: string | null;
  url: string | null;
  license: string | null;
  subject: string | null;
  reliability_notes: string | null;
  metadata_origin: string | null;
};

export type DocumentSummary = {
  id: string;
  filename: string;
  relative_path: string;
  origin: 'documentos' | 'upload' | 'fixtures';
  file_type: string;
  size_bytes: number;
  status: DocumentStatus;
  error_message: string | null;
  page_count: number | null;
  chunk_count: number;
  metadata: SourceMetadata;
  warnings: string[];
  created_at: string;
  updated_at: string;
  indexed_at: string | null;
};

export type Paginated<T> = { items: T[]; total: number; page: number; page_size: number };

export type ChunkOut = {
  id: string;
  document_id: string;
  ordinal: number;
  page: number | null;
  section: string | null;
  text: string;
  char_start: number;
  char_end: number;
  suspicious: boolean;
};

export type SourceDetail = { chunk: ChunkOut; document: DocumentSummary };
export type UploadResult = { document: DocumentSummary; message: string };
export type DeleteResult = {
  document_id: string;
  removed_vectors: number;
  removed_chunks: number;
  original_file_deleted: boolean;
  message: string;
};

export type IngestionStats = {
  scanned: number;
  new: number;
  updated: number;
  unchanged: number;
  failed: number;
  skipped: number;
  removed: number;
  chunks_indexed: number;
  processed_so_far: number;
  to_process: number;
  /** Documentos ainda pendentes (na Vercel, cada chamada tem orçamento de tempo; chame /scan novamente). */
  remaining: number;
};

export type IngestionRun = {
  id: string;
  kind: 'scan' | 'reindex' | 'startup' | 'upload' | 'rebuild';
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at: string | null;
  stats: IngestionStats;
  error_message: string | null;
};

export type IndexStatus = {
  backend: string;
  metric: string;
  vectors: number;
  chunks_in_database: number;
  consistent: boolean;
  compatible: boolean;
  embedding_fingerprint: string | null;
  current_embedding_fingerprint: string | null;
  embedding_semantic: boolean | null;
  message: string | null;
};

export type IngestionStatus = {
  running: boolean;
  current: IngestionRun | null;
  last: IngestionRun | null;
  index: IndexStatus;
};

export type ChatFilters = { document_ids?: string[]; file_types?: string[]; subject?: string };
export type ChatRequest = { question: string; conversation_id?: string; filters?: ChatFilters; top_k?: number };

export type Citation = {
  label: string;
  source_id: string;
  document_id: string;
  document_title: string;
  filename: string;
  page: number | null;
  section: string | null;
  excerpt: string;
  relevance: number;
  url: string | null;
  license: string | null;
  author: string | null;
  institution: string | null;
  published_date: string | null;
  version: string | null;
  origin: string;
  suspicious: boolean;
  cited_in_answer: boolean;
};

export type RetrievedCandidate = {
  source_id: string;
  document_id: string;
  document_title: string;
  filename: string;
  page: number | null;
  score: number;
  selected: boolean;
  reason: string | null;
};

export type RetrievalInfo = {
  top_k: number;
  similarity_threshold: number;
  metric: string;
  filters: ChatFilters | null;
  candidates_considered: number;
  selected: number;
  best_score: number | null;
  embedding_provider: string;
  embedding_model: string;
  embedding_semantic: boolean;
  candidates: RetrievedCandidate[];
};

export type GenerationInfo = {
  provider: string;
  model: string;
  mode: 'demo_extractive' | 'llm' | 'none';
  is_llm: boolean;
};

export type ChatResponse = {
  interaction_id: string;
  conversation_id: string;
  question: string;
  status: ChatStatus;
  evidence_status: EvidenceStatus;
  answer: string | null;
  notice: string | null;
  citations: Citation[];
  citations_valid: boolean;
  warnings: string[];
  retrieval: RetrievalInfo | null;
  generation: GenerationInfo;
  latency: { retrieval_ms: number | null; generation_ms: number | null; total_ms: number };
  created_at: string;
};

export type ChatHistory = { conversation_id: string; items: ChatResponse[] };

export type EvaluationCategoryStats = {
  label: string;
  executed: number;
  passed: number;
  pass_rate: number;
};

export type EvaluationSummary = {
  run_id: string;
  suite: string;
  status: string;
  executed: number;
  passed: number;
  failed: number;
  pass_rate: number | null;
  target: number;
  target_met: boolean | null;
  by_category: Record<string, EvaluationCategoryStats>;
  retrieval_metrics: Record<string, number | null>;
  started_at: string;
  finished_at: string | null;
  params: Record<string, unknown>;
};

export type Stats = {
  documents_total: number;
  documents_processed: number;
  documents_failed: number;
  documents_pending: number;
  documents_excluded: number;
  chunks_indexed: number;
  last_indexed_at: string | null;
  questions_total: number;
  questions_answered: number;
  refusals: number;
  avg_retrieval_ms: number | null;
  avg_generation_ms: number | null;
  avg_total_ms: number | null;
  avg_sources_per_answer: number | null;
  citation_valid_rate: number | null;
  ingestion_success_rate: number | null;
  last_evaluation: EvaluationSummary | null;
  using_fixtures_only: boolean;
};

export type Health = {
  status: 'ok' | 'degraded';
  app_env: string;
  version: string;
  database: boolean;
  storage: { backend: 'sqlite' | 'postgres'; persistent: boolean; serverless: boolean; originals_in_database: boolean };
  embeddings: { provider: string; model: string; available: boolean; loaded: boolean; semantic: boolean | null; error: string | null };
  vector_store: { backend: string; vectors: number; compatible: boolean; metric: string };
  llm: { provider: string; model: string; is_llm: boolean; mode: string; configured: boolean };
  documents_dir_exists: boolean;
  issues: string[];
};

export type SettingsOut = {
  embedding_provider: string;
  embedding_model: string;
  embedding_semantic: boolean | null;
  embedding_available: boolean;
  llm_provider: string;
  llm_model: string;
  llm_configured: boolean;
  llm_is_real: boolean;
  vector_store: string;
  similarity_metric: string;
  chunk_size: number;
  chunk_overlap: number;
  chunk_unit: string;
  top_k: number;
  similarity_threshold: number;
  weak_evidence_margin: number;
  min_term_coverage: number;
  available_filters: string[];
  max_upload_size_mb: number;
  max_question_chars: number;
  supported_file_types: string[];
  admin_required: boolean;
  serverless: boolean;
  storage_backend: 'sqlite' | 'postgres';
  persistent_storage: boolean;
  ingestion_time_budget_seconds: number | null;
  history_retention_days: number;
  app_env: string;
  editable: string[];
  overrides: Record<string, number>;
  requires_reindex: boolean;
};

export type SettingsUpdate = {
  top_k?: number;
  similarity_threshold?: number;
  chunk_size?: number;
  chunk_overlap?: number;
  confirm_reindex?: boolean;
};

export type EvaluationCase = {
  id: string;
  category: 'present' | 'absent' | 'out_of_scope' | 'adversarial';
  question: string;
  expected_behavior: 'answer' | 'refuse';
  expected_answer: string;
  expected_keywords: string[];
  expected_sources: string[];
  expected_evidence: string | null;
  forbidden_terms: string[];
  notes: string | null;
};

export type EvaluationSuite = {
  id: string;
  title: string;
  description: string;
  synthetic: boolean;
  ready: boolean;
  cases: EvaluationCase[];
};

export type EvaluationRunInfo = {
  id: string;
  suite: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  summary: EvaluationSummary | null;
};

export type EvaluationCurrent = { suite: string; status: 'running' | 'completed' | 'failed'; run_id: string | null; error: string | null };

export type EvaluationsOverview = {
  suites: EvaluationSuite[];
  runs: EvaluationRunInfo[];
  current: EvaluationCurrent | null;
};

export type EvaluationCaseResult = {
  case_id: string;
  category: string;
  question: string;
  expected_behavior: string;
  expected_answer: string;
  obtained_answer: string | null;
  status: string;
  evidence_status: string;
  retrieved_sources: { label: string; source_id: string; filename: string; page: number | null; relevance: number; cited_in_answer: boolean }[];
  citations_valid: boolean;
  fidelity: Record<string, unknown>;
  checks: Record<string, boolean>;
  passed: boolean;
  failure: string | null;
  adjustment: string | null;
  adjustment_at: string | null;
  retrieval_rank: number | null;
  latency_ms: number | null;
};

export type EvaluationResults = { summary: EvaluationSummary; results: EvaluationCaseResult[] };

export type MentorEntryIn = {
  entry_date: string;
  stage: string;
  prompt: string;
  response: string;
  evidence?: string | null;
  decision: string;
  change_made?: string | null;
  test_executed?: string | null;
  result_before?: string | null;
  result_after?: string | null;
  author?: string | null;
};

export type MentorEntry = MentorEntryIn & { id: string; created_at: string };
export type MentorLog = { items: MentorEntry[]; total: number };
