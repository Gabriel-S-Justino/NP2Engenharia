"""Schemas Pydantic de requisição e resposta da API (contrato com o frontend).

Os tipos TypeScript equivalentes ficam em `apps/mobile/types/api.ts` e o contrato
está documentado em `docs/CONTRATO_FRONTEND.md`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DocumentStatus = Literal["pending", "processing", "processed", "failed", "excluded"]
ChatStatus = Literal[
    "answered",
    "insufficient_evidence",
    "out_of_scope",
    "no_documents",
    "blocked",
    "provider_error",
    "index_unavailable",
]
EvidenceStatus = Literal["sufficient", "weak", "conflicting", "insufficient", "none"]


class ErrorBody(BaseModel):
    code: str
    message: str
    details: object | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


# ---------------------------------------------------------------------------
# Metadados e documentos
# ---------------------------------------------------------------------------
class SourceMetadata(BaseModel):
    """Metadados de uma fonte. Campos ausentes são `null` e exibidos como "não informado"."""

    title: str | None = None
    author: str | None = None
    institution: str | None = None
    published_date: str | None = None
    version: str | None = None
    url: str | None = None
    license: str | None = None
    subject: str | None = None
    reliability_notes: str | None = None
    metadata_origin: str | None = Field(default=None, description="manifesto, pdf, upload ou inferido do nome do arquivo")


class DocumentSummary(BaseModel):
    id: str
    filename: str
    relative_path: str
    origin: Literal["documentos", "upload", "fixtures"]
    file_type: str
    size_bytes: int
    status: DocumentStatus
    error_message: str | None = None
    page_count: int | None = None
    chunk_count: int
    metadata: SourceMetadata
    warnings: list[str] = []
    created_at: str
    updated_at: str
    indexed_at: str | None = None


class DocumentList(BaseModel):
    items: list[DocumentSummary]
    total: int
    page: int
    page_size: int


class ChunkOut(BaseModel):
    id: str
    document_id: str
    ordinal: int
    page: int | None
    section: str | None
    text: str
    char_start: int
    char_end: int
    suspicious: bool = Field(description="Trecho contém texto com formato de instrução; tratado apenas como dado.")


class ChunkList(BaseModel):
    items: list[ChunkOut]
    total: int
    page: int
    page_size: int


class SourceDetail(BaseModel):
    chunk: ChunkOut
    document: DocumentSummary


class UploadResult(BaseModel):
    document: DocumentSummary
    message: str


class DeleteResult(BaseModel):
    document_id: str
    removed_vectors: int
    removed_chunks: int
    original_file_deleted: bool
    message: str


# ---------------------------------------------------------------------------
# Ingestão
# ---------------------------------------------------------------------------
class IngestionStats(BaseModel):
    scanned: int = 0
    new: int = 0
    updated: int = 0
    unchanged: int = 0
    failed: int = 0
    skipped: int = 0
    removed: int = 0
    chunks_indexed: int = 0
    processed_so_far: int = 0
    to_process: int = 0
    remaining: int = Field(default=0, description="Pendentes para a próxima execução (orçamento de tempo esgotado)")


class IngestionRun(BaseModel):
    id: str
    kind: Literal["scan", "reindex", "startup", "upload", "rebuild"]
    status: Literal["running", "completed", "failed"]
    started_at: str
    finished_at: str | None = None
    stats: IngestionStats
    error_message: str | None = None


class IngestionStatus(BaseModel):
    running: bool
    current: IngestionRun | None
    last: IngestionRun | None
    index: IndexStatus


class IndexStatus(BaseModel):
    backend: str
    metric: str
    vectors: int
    chunks_in_database: int
    consistent: bool
    compatible: bool
    embedding_fingerprint: str | None
    current_embedding_fingerprint: str | None
    embedding_semantic: bool | None
    message: str | None = None


class ReindexRequest(BaseModel):
    document_ids: list[str] | None = Field(default=None, description="Vazio = reindexar todo o acervo")


# ---------------------------------------------------------------------------
# Chat / RAG
# ---------------------------------------------------------------------------
class ChatFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_ids: list[str] | None = None
    file_types: list[str] | None = None
    subject: str | None = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=10000)
    conversation_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    filters: ChatFilters | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)

    @field_validator("question")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A pergunta não pode estar vazia.")
        return value.strip()


class Citation(BaseModel):
    label: str = Field(description="Rótulo exibido na resposta, ex.: F1")
    source_id: str = Field(description="ID estável do chunk (usado em GET /api/sources/{source_id})")
    document_id: str
    document_title: str
    filename: str
    page: int | None
    section: str | None
    excerpt: str
    relevance: float = Field(description="Similaridade de cosseno com a pergunta; NÃO é probabilidade de acerto")
    url: str | None = None
    license: str | None = None
    author: str | None = None
    institution: str | None = None
    published_date: str | None = None
    version: str | None = None
    origin: str
    suspicious: bool = False
    cited_in_answer: bool = True


class RetrievedCandidate(BaseModel):
    source_id: str
    document_id: str
    document_title: str
    filename: str
    page: int | None
    score: float
    selected: bool
    reason: str | None = None


class RetrievalInfo(BaseModel):
    top_k: int
    similarity_threshold: float
    metric: str
    filters: ChatFilters | None
    candidates_considered: int
    selected: int
    best_score: float | None
    embedding_provider: str
    embedding_model: str
    embedding_semantic: bool
    candidates: list[RetrievedCandidate]


class GenerationInfo(BaseModel):
    provider: str
    model: str
    mode: Literal["demo_extractive", "llm", "none"]
    is_llm: bool


class Latency(BaseModel):
    retrieval_ms: float | None = None
    generation_ms: float | None = None
    total_ms: float


class ChatResponse(BaseModel):
    interaction_id: str
    conversation_id: str
    question: str
    status: ChatStatus
    evidence_status: EvidenceStatus
    answer: str | None
    notice: str | None = Field(default=None, description="Aviso ao usuário sobre limitações da resposta")
    citations: list[Citation]
    citations_valid: bool
    warnings: list[str] = []
    retrieval: RetrievalInfo | None
    generation: GenerationInfo
    latency: Latency
    created_at: str


class ChatHistory(BaseModel):
    conversation_id: str
    items: list[ChatResponse]


class ClearHistoryResult(BaseModel):
    conversation_id: str
    removed: int


# ---------------------------------------------------------------------------
# Estatísticas, saúde e configurações
# ---------------------------------------------------------------------------
class EvaluationSummary(BaseModel):
    run_id: str
    suite: str
    status: str
    executed: int
    passed: int
    failed: int
    pass_rate: float | None
    target: float
    target_met: bool | None
    by_category: dict[str, dict[str, str | float | int | None]]
    retrieval_metrics: dict[str, float | None]
    started_at: str
    finished_at: str | None
    params: dict


class Stats(BaseModel):
    documents_total: int
    documents_processed: int
    documents_failed: int
    documents_pending: int
    documents_excluded: int
    chunks_indexed: int
    last_indexed_at: str | None
    questions_total: int
    questions_answered: int
    refusals: int
    avg_retrieval_ms: float | None
    avg_generation_ms: float | None
    avg_total_ms: float | None
    avg_sources_per_answer: float | None
    citation_valid_rate: float | None
    ingestion_success_rate: float | None
    last_evaluation: EvaluationSummary | None
    using_fixtures_only: bool


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    app_env: str
    version: str
    database: bool
    storage: dict
    embeddings: dict
    vector_store: dict
    llm: dict
    documents_dir_exists: bool
    issues: list[str]


class SettingsOut(BaseModel):
    embedding_provider: str
    embedding_model: str
    embedding_semantic: bool | None
    embedding_available: bool
    llm_provider: str
    llm_model: str
    llm_configured: bool
    llm_is_real: bool
    vector_store: str
    similarity_metric: str
    chunk_size: int
    chunk_overlap: int
    chunk_unit: str
    top_k: int
    similarity_threshold: float
    weak_evidence_margin: float
    min_term_coverage: float
    available_filters: list[str]
    max_upload_size_mb: int
    max_question_chars: int
    supported_file_types: list[str]
    admin_required: bool
    serverless: bool
    storage_backend: str
    persistent_storage: bool
    ingestion_time_budget_seconds: float | None
    history_retention_days: int
    app_env: str
    editable: list[str]
    overrides: dict
    requires_reindex: bool


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    top_k: int | None = Field(default=None, ge=1, le=20)
    similarity_threshold: float | None = Field(default=None, ge=-1.0, le=1.0)
    chunk_size: int | None = Field(default=None, ge=200, le=4000)
    chunk_overlap: int | None = Field(default=None, ge=0, le=1000)
    confirm_reindex: bool = False


# ---------------------------------------------------------------------------
# Avaliação
# ---------------------------------------------------------------------------
class EvaluationCase(BaseModel):
    id: str
    category: Literal["present", "absent", "out_of_scope", "adversarial"]
    question: str
    expected_behavior: Literal["answer", "refuse"]
    expected_answer: str
    expected_keywords: list[str] = []
    expected_sources: list[str] = []
    expected_evidence: str | None = None
    forbidden_terms: list[str] = []
    notes: str | None = None


class EvaluationSuite(BaseModel):
    id: str
    title: str
    description: str
    synthetic: bool
    ready: bool
    cases: list[EvaluationCase]


class EvaluationRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    suite: str = Field(default="fixtures", pattern=r"^[a-z0-9_-]+$")


class EvaluationCaseResult(BaseModel):
    case_id: str
    category: str
    question: str
    expected_behavior: str
    expected_answer: str
    obtained_answer: str | None
    status: str
    evidence_status: str
    retrieved_sources: list[dict]
    citations_valid: bool
    fidelity: dict
    checks: dict[str, bool]
    passed: bool
    failure: str | None
    adjustment: str | None = None
    adjustment_at: str | None = None
    retrieval_rank: int | None = None
    latency_ms: float | None = None


class EvaluationResults(BaseModel):
    summary: EvaluationSummary
    results: list[EvaluationCaseResult]


class AdjustmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    adjustment: str = Field(min_length=3, max_length=4000)


# ---------------------------------------------------------------------------
# Diário da IA mentora
# ---------------------------------------------------------------------------
class MentorEntryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entry_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    stage: str = Field(min_length=2, max_length=200)
    prompt: str = Field(min_length=5, max_length=20000)
    response: str = Field(min_length=5, max_length=50000)
    evidence: str | None = Field(default=None, max_length=20000)
    decision: str = Field(min_length=3, max_length=10000)
    change_made: str | None = Field(default=None, max_length=10000)
    test_executed: str | None = Field(default=None, max_length=10000)
    result_before: str | None = Field(default=None, max_length=10000)
    result_after: str | None = Field(default=None, max_length=10000)
    author: str | None = Field(default=None, max_length=200)


class MentorEntry(MentorEntryIn):
    id: str
    created_at: str


class MentorLog(BaseModel):
    items: list[MentorEntry]
    total: int


IngestionStatus.model_rebuild()
