"""Endpoints REST da API (documentados automaticamente em /docs e /openapi.json)."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse

from app import __version__
from app.core.container import Container
from app.core.errors import (
    AppError,
    ConflictError,
    NotFoundError,
    PayloadTooLargeError,
    UnsupportedMediaError,
)
from app.core.security import rate_limit_chat, require_admin, safe_child, sanitize_filename
from app.repositories.documents import row_to_chunk
from app.schemas.models import (
    AdjustmentRequest,
    ChatHistory,
    ChatRequest,
    ChatResponse,
    ChunkList,
    ClearHistoryResult,
    DeleteResult,
    DocumentList,
    DocumentSummary,
    ErrorResponse,
    EvaluationResults,
    EvaluationRunRequest,
    EvaluationSuite,
    EvaluationSummary,
    Health,
    IngestionRun,
    IngestionStatus,
    MentorEntry,
    MentorEntryIn,
    MentorLog,
    ReindexRequest,
    SettingsOut,
    SettingsUpdate,
    SourceDetail,
    Stats,
    UploadResult,
)
from app.services.document_loader import PDF_MAGIC, SUPPORTED_EXTENSIONS, DocumentReadError, decode_text
from app.services.ingestion import DiscoveredFile
from app.services.vector_store import METRIC

ERRORS = {
    400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 404: {"model": ErrorResponse},
    409: {"model": ErrorResponse}, 413: {"model": ErrorResponse}, 415: {"model": ErrorResponse},
    422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}, 503: {"model": ErrorResponse},
}

router = APIRouter(prefix="/api", responses=ERRORS)
admin = [Depends(require_admin)]


def container(request: Request) -> Container:
    return request.app.state.container


# ---------------------------------------------------------------------------
# Saúde e estatísticas
# ---------------------------------------------------------------------------
@router.get("/health", response_model=Health, tags=["sistema"], summary="Estado do backend e dos componentes")
def health(request: Request) -> Health:
    c = container(request)
    p, s = c.pipeline, c.settings
    issues: list[str] = []
    try:
        p.db.scalar("SELECT 1")
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok, issues = False, issues + ["Banco de dados indisponível."]
    emb = p._embedder
    embeddings = {
        "provider": s.embedding_provider,
        "model": emb.model if emb else s.embedding_model,
        "available": emb is not None,
        "semantic": emb.semantic if emb else None,
        "error": p.embedder_error,
    }
    if emb is None:
        issues.append("Modelo de embeddings indisponível.")
    elif not emb.semantic:
        issues.append("Embeddings lexicais (hashing) em uso: a busca NÃO é semântica. Use apenas em testes/demonstração.")
    idx = p.index_status()
    if not idx.compatible:
        issues.append(idx.message or "Índice incompatível com o modelo atual.")
    llm = {**p.generator.describe(), "configured": s.llm_provider == "demo" or s.llm_api_key is not None}
    critical = not db_ok or emb is None or not idx.compatible
    return Health(
        status="degraded" if critical else "ok",
        app_env=s.app_env,
        version=__version__,
        database=db_ok,
        embeddings=embeddings,
        vector_store={"backend": idx.backend, "vectors": idx.vectors, "compatible": idx.compatible, "metric": METRIC},
        llm=llm,
        documents_dir_exists=s.documents_dir.exists(),
        issues=issues,
    )


@router.get("/stats", response_model=Stats, tags=["sistema"], summary="Indicadores reais do acervo e do uso")
def stats(request: Request) -> Stats:
    c = container(request)
    p = c.pipeline
    counts = p.documents.counts()
    metrics = p.chat.metrics()
    latest = c.evaluations.latest()
    origins = {row["origin"] for row in p.documents.all_rows()}

    def rnd(value, digits=2):
        return round(value, digits) if value is not None else None

    return Stats(
        documents_total=sum(counts.values()),
        documents_processed=counts.get("processed", 0),
        documents_failed=counts.get("failed", 0),
        documents_pending=counts.get("pending", 0) + counts.get("processing", 0),
        documents_excluded=counts.get("excluded", 0),
        chunks_indexed=p.documents.total_chunks(),
        last_indexed_at=p.documents.last_indexed_at(),
        questions_total=int(metrics.get("total") or 0),
        questions_answered=int(metrics.get("answered") or 0),
        refusals=int(metrics.get("refusals") or 0),
        avg_retrieval_ms=rnd(metrics.get("avg_retrieval")),
        avg_generation_ms=rnd(metrics.get("avg_generation")),
        avg_total_ms=rnd(metrics.get("avg_total")),
        avg_sources_per_answer=rnd(metrics.get("avg_sources")),
        citation_valid_rate=rnd(metrics.get("valid_rate"), 3),
        ingestion_success_rate=rnd(p.ingestion_runs.success_rate(), 3),
        last_evaluation=latest.summary if latest else None,
        using_fixtures_only=bool(origins)
        and (origins <= {"fixtures"} or c.settings.documents_dir.resolve() == c.settings.fixtures_dir.resolve()),
    )


# ---------------------------------------------------------------------------
# Documentos
# ---------------------------------------------------------------------------
@router.get("/documents", response_model=DocumentList, tags=["documentos"], summary="Lista paginada de documentos")
def list_documents(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status", pattern="^(pending|processing|processed|failed|excluded)$"),
    search: str | None = Query(None, max_length=200),
    file_type: str | None = Query(None, pattern="^(pdf|txt|md)$"),
    sort: str = Query("name", pattern="^(name|updated|status|size)$"),
) -> DocumentList:
    items, total = container(request).pipeline.documents.list(
        page=page, page_size=page_size, status=status_filter, search=search, file_type=file_type, sort=sort
    )
    return DocumentList(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "/documents/upload", response_model=UploadResult, status_code=status.HTTP_201_CREATED, tags=["documentos"],
    dependencies=admin, summary="Envia um PDF/TXT/MD para o acervo (validação de tipo real e tamanho)",
)
async def upload_document(request: Request, file: UploadFile = File(...)) -> UploadResult:
    c = container(request)
    s, p = c.settings, c.pipeline
    filename = sanitize_filename(file.filename or "documento")
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in SUPPORTED_EXTENSIONS:
        raise UnsupportedMediaError(f"Tipo de arquivo não suportado. Envie: {', '.join(sorted(SUPPORTED_EXTENSIONS))}.")
    data = bytearray()
    while chunk := await file.read(1024 * 1024):
        data.extend(chunk)
        if len(data) > s.max_upload_bytes:
            raise PayloadTooLargeError(f"O arquivo excede o limite de {s.max_upload_size_mb} MB.")
    if not data:
        raise AppError("O arquivo enviado está vazio.", code="arquivo_vazio")
    if ext == ".pdf" and not bytes(data[:5]) == PDF_MAGIC:
        raise UnsupportedMediaError("O conteúdo não corresponde a um PDF válido.", code="conteudo_invalido")
    if ext in (".txt", ".md"):
        try:
            decode_text(bytes(data))
        except DocumentReadError as exc:
            raise UnsupportedMediaError(str(exc), code="conteudo_invalido") from exc
    sha = hashlib.sha256(data).hexdigest()
    existing = p.documents.find_by_sha(sha)
    if existing is not None:
        raise ConflictError(f"Este conteúdo já está no acervo como '{existing['filename']}'.", code="duplicado")

    target = safe_child(s.uploads_dir, filename)
    stem, suffix = target.stem, target.suffix
    counter = 1
    while target.exists():
        target = safe_child(s.uploads_dir, f"{stem}_{counter}{suffix}")
        counter += 1
    target.write_bytes(bytes(data))
    discovered = DiscoveredFile("upload", s.uploads_dir, target, target.name)
    p.documents.upsert(
        document_id=discovered.document_id, origin="upload", relative_path=target.name, filename=target.name,
        file_type=ext.lstrip("."), size_bytes=len(data), sha256=sha, status="pending",
        metadata={"title": target.stem.replace("_", " "), "metadata_origin": "upload"},
        file_modified_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
    message = "Arquivo recebido. A indexação foi iniciada."
    try:
        p.ingestion.start("upload")
    except ConflictError:
        message = "Arquivo recebido. Há uma indexação em andamento; ele será processado na próxima indexação."
    return UploadResult(document=p.documents.get(discovered.document_id), message=message)


@router.get("/documents/{document_id}", response_model=DocumentSummary, tags=["documentos"])
def get_document(request: Request, document_id: str) -> DocumentSummary:
    doc = container(request).pipeline.documents.get(document_id)
    if doc is None:
        raise NotFoundError("Documento não encontrado.")
    return doc


@router.get("/documents/{document_id}/chunks", response_model=ChunkList, tags=["documentos"],
            summary="Trechos indexados de um documento")
def get_document_chunks(
    request: Request, document_id: str, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)
) -> ChunkList:
    p = container(request).pipeline
    if p.documents.get(document_id) is None:
        raise NotFoundError("Documento não encontrado.")
    items, total = p.documents.list_chunks(document_id, page=page, page_size=page_size)
    return ChunkList(items=items, total=total, page=page, page_size=page_size)


@router.delete("/documents/{document_id}", response_model=DeleteResult, tags=["documentos"], dependencies=admin,
               summary="Remove o documento do índice (arquivos de Documentos/ são preservados)")
def delete_document(request: Request, document_id: str) -> DeleteResult:
    c = container(request)
    p = c.pipeline
    row = p.documents.get_row(document_id)
    if row is None:
        raise NotFoundError("Documento não encontrado.")
    if p.ingestion.running:
        raise ConflictError("Aguarde a indexação em andamento terminar antes de remover documentos.")
    removed_vectors, removed_chunks = p.remove_document_data(document_id)
    deleted_file = False
    if row["origin"] == "upload":
        path = safe_child(c.settings.uploads_dir, row["relative_path"])
        if path.exists():
            path.unlink()
            deleted_file = True
        p.documents.delete(document_id)
        message = "Documento enviado removido do acervo, do índice e do armazenamento."
    else:
        p.documents.set_status(
            document_id, "excluded",
            error="Removido do índice pelo usuário. O arquivo original foi preservado em Documentos/.",
        )
        message = (
            "Documento removido do índice. O arquivo original em Documentos/ foi preservado; "
            "para reincluí-lo, use a reindexação deste documento."
        )
    return DeleteResult(document_id=document_id, removed_vectors=removed_vectors, removed_chunks=removed_chunks,
                        original_file_deleted=deleted_file, message=message)


@router.get("/sources/{source_id}", response_model=SourceDetail, tags=["fontes"],
            summary="Detalhes de um trecho citado e do documento de origem")
def get_source(request: Request, source_id: str) -> SourceDetail:
    p = container(request).pipeline
    row = p.documents.get_chunk(source_id)
    if row is None:
        raise NotFoundError("Fonte não encontrada. O documento pode ter sido removido ou reindexado.")
    document = p.documents.get(row["document_id"])
    return SourceDetail(chunk=row_to_chunk(row), document=document)


# ---------------------------------------------------------------------------
# Ingestão
# ---------------------------------------------------------------------------
@router.post("/ingestion/scan", response_model=IngestionRun, status_code=202, tags=["ingestão"], dependencies=admin,
             summary="Varre Documentos/ e uploads e indexa arquivos novos ou alterados")
def ingestion_scan(request: Request, wait: bool = Query(False)) -> IngestionRun:
    p = container(request).pipeline
    _ensure_index_ready(p)
    run = p.ingestion.start("scan", wait=wait)
    return p.ingestion_runs.last() if wait else run


@router.post("/ingestion/reindex", response_model=IngestionRun, status_code=202, tags=["ingestão"],
             dependencies=admin, summary="Reprocessa todo o acervo ou documentos específicos")
def ingestion_reindex(request: Request, body: ReindexRequest | None = None, wait: bool = Query(False)) -> IngestionRun:
    p = container(request).pipeline
    ids = body.document_ids if body and body.document_ids else None
    if ids is None:
        # Reindexação completa também resolve índices incompatíveis com o modelo atual.
        p.ensure_embedder()
        p.reset_index()
    run = p.ingestion.start("reindex", force=True, document_ids=ids, wait=wait)
    return p.ingestion_runs.last() if wait else run


def _ensure_index_ready(p) -> None:
    if not p.index_compatible:
        raise ConflictError(p.index_message or "Índice incompatível. Execute a reindexação completa.",
                            code="indice_incompativel")


@router.get("/ingestion/status", response_model=IngestionStatus, tags=["ingestão"])
def ingestion_status(request: Request) -> IngestionStatus:
    p = container(request).pipeline
    return IngestionStatus(running=p.ingestion.running, current=p.ingestion.current, last=p.ingestion_runs.last(),
                           index=p.index_status())


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
@router.post("/chat", response_model=ChatResponse, tags=["chat"], dependencies=[Depends(rate_limit_chat)],
             summary="Pergunta ao acervo: recuperação, geração e citações verificáveis")
def chat(request: Request, body: ChatRequest) -> ChatResponse:
    c = container(request)
    if len(body.question) > c.settings.max_question_chars:
        raise AppError(f"A pergunta excede o limite de {c.settings.max_question_chars} caracteres.",
                       code="pergunta_muito_longa", status_code=422)
    return c.pipeline.answer(body.question, conversation_id=body.conversation_id, filters=body.filters,
                             top_k=body.top_k)


@router.get("/chat/history/{conversation_id}", response_model=ChatHistory, tags=["chat"])
def chat_history(request: Request, conversation_id: str) -> ChatHistory:
    items = container(request).pipeline.chat.history(conversation_id)
    return ChatHistory(conversation_id=conversation_id, items=items)


@router.delete("/chat/history/{conversation_id}", response_model=ClearHistoryResult, tags=["chat"])
def clear_chat_history(request: Request, conversation_id: str) -> ClearHistoryResult:
    removed = container(request).pipeline.chat.clear(conversation_id)
    return ClearHistoryResult(conversation_id=conversation_id, removed=removed)


# ---------------------------------------------------------------------------
# Avaliação
# ---------------------------------------------------------------------------
@router.get("/evaluations", tags=["avaliação"], summary="Suítes de teste disponíveis e execuções recentes")
def list_evaluations(request: Request) -> dict:
    c = container(request)
    suites: list[EvaluationSuite] = list(c.evaluations.suites().values())
    runs = [
        {
            "id": r["id"], "suite": r["suite"], "status": r["status"], "started_at": r["started_at"],
            "finished_at": r["finished_at"], "error_message": r["error_message"],
            "summary": json.loads(r["summary_json"] or "{}") or None,
        }
        for r in c.evaluations.repository.list_runs()
    ]
    return {"suites": [s.model_dump() for s in suites], "runs": runs, "current": c.current_evaluation}


@router.post("/evaluations/run", status_code=202, tags=["avaliação"], dependencies=admin,
             summary="Executa a matriz de avaliação (em segundo plano, ou aguardando com wait=true)")
def run_evaluation(request: Request, body: EvaluationRunRequest, wait: bool = Query(False)) -> dict:
    return container(request).run_evaluation(body.suite, wait=wait)


@router.get("/evaluations/results", response_model=EvaluationResults, tags=["avaliação"])
def evaluation_results(request: Request, run_id: str | None = Query(None), suite: str | None = Query(None)):
    c = container(request)
    result = c.evaluations.results_for(run_id) if run_id else c.evaluations.latest(suite)
    if result is None:
        return JSONResponse(status_code=404, content={"error": {
            "code": "sem_avaliacao", "message": "Ainda não avaliado. Execute os testes para conhecer o desempenho atual."}})
    return result


@router.post("/evaluations/results/{run_id}/cases/{case_id}/adjustment", response_model=EvaluationSummary,
             tags=["avaliação"], dependencies=admin, summary="Registra o ajuste aplicado após uma falha")
def register_adjustment(request: Request, run_id: str, case_id: str, body: AdjustmentRequest) -> EvaluationSummary:
    c = container(request)
    if not c.evaluations.repository.set_adjustment(run_id, case_id, body.adjustment):
        raise NotFoundError("Execução ou caso de teste não encontrado.")
    result = c.evaluations.results_for(run_id)
    return result.summary


# ---------------------------------------------------------------------------
# Configurações
# ---------------------------------------------------------------------------
EDITABLE = ["top_k", "similarity_threshold", "chunk_size", "chunk_overlap"]


@router.get("/settings", response_model=SettingsOut, tags=["sistema"], summary="Configuração efetiva (sem segredos)")
def get_settings_view(request: Request) -> SettingsOut:
    c = container(request)
    s, p = c.settings, c.pipeline
    params = p.effective_params()
    emb = p._embedder
    docs_need_reindex = any(
        p.db.get_kv(f"chunk_params:{row['id']}") not in (None, p.chunk_params_signature())
        for row in p.documents.all_rows() if row["status"] == "processed"
    )
    return SettingsOut(
        embedding_provider=s.embedding_provider,
        embedding_model=emb.model if emb else s.embedding_model,
        embedding_semantic=emb.semantic if emb else None,
        embedding_available=emb is not None,
        llm_provider=s.llm_provider,
        llm_model=p.generator.model,
        llm_configured=s.llm_provider == "demo" or s.llm_api_key is not None,
        llm_is_real=p.generator.is_llm,
        vector_store=s.vector_store,
        similarity_metric=METRIC,
        chunk_size=params["chunk_size"],
        chunk_overlap=params["chunk_overlap"],
        chunk_unit="caracteres",
        top_k=params["top_k"],
        similarity_threshold=params["similarity_threshold"],
        weak_evidence_margin=s.weak_evidence_margin,
        min_term_coverage=s.min_term_coverage,
        available_filters=["document_ids", "file_types", "subject"],
        max_upload_size_mb=s.max_upload_size_mb,
        max_question_chars=s.max_question_chars,
        supported_file_types=sorted(e.lstrip(".") for e in SUPPORTED_EXTENSIONS),
        admin_required=s.admin_required,
        history_retention_days=s.history_retention_days,
        app_env=s.app_env,
        editable=EDITABLE,
        overrides=p.overrides(),
        requires_reindex=docs_need_reindex or not p.index_compatible,
    )


@router.patch("/settings", response_model=SettingsOut, tags=["sistema"], dependencies=admin,
              summary="Ajusta parâmetros de recuperação/chunking com validação")
def update_settings(request: Request, body: SettingsUpdate) -> SettingsOut:
    c = container(request)
    p = c.pipeline
    current = p.effective_params()
    size = body.chunk_size if body.chunk_size is not None else current["chunk_size"]
    overlap = body.chunk_overlap if body.chunk_overlap is not None else current["chunk_overlap"]
    if overlap >= size:
        raise AppError("A sobreposição deve ser menor que o tamanho do chunk.", code="config_invalida", status_code=422)
    if size <= c.settings.min_chunk_chars:
        raise AppError("O tamanho do chunk deve ser maior que o mínimo de caracteres por trecho.",
                       code="config_invalida", status_code=422)
    chunking_changed = (size, overlap) != (current["chunk_size"], current["chunk_overlap"])
    if chunking_changed and not body.confirm_reindex:
        raise ConflictError("Alterar o chunking exige reindexar o acervo. Confirme com confirm_reindex=true.",
                            code="confirmacao_necessaria")
    if chunking_changed and p.ingestion.running:
        raise ConflictError("Aguarde a indexação em andamento terminar.")
    p.set_overrides({
        "top_k": body.top_k, "similarity_threshold": body.similarity_threshold,
        "chunk_size": body.chunk_size, "chunk_overlap": body.chunk_overlap,
    })
    if chunking_changed:
        p.ingestion.start("reindex", force=True)
    return get_settings_view(request)


# ---------------------------------------------------------------------------
# Diário da IA mentora
# ---------------------------------------------------------------------------
@router.get("/mentor-log", response_model=MentorLog, tags=["mentoria"])
def mentor_log(request: Request) -> MentorLog:
    items = container(request).mentor.list()
    return MentorLog(items=items, total=len(items))


@router.post("/mentor-log", response_model=MentorEntry, status_code=201, tags=["mentoria"], dependencies=admin,
             summary="Registra uma interação real com a IA mentora e a decisão da equipe")
def add_mentor_entry(request: Request, body: MentorEntryIn) -> MentorEntry:
    return container(request).mentor.add(body)


@router.get("/evaluations/runs/{run_id}", tags=["avaliação"], summary="Estado de uma execução de avaliação")
def evaluation_run_status(request: Request, run_id: str) -> dict:
    row = container(request).evaluations.repository.get_run(run_id)
    if row is None:
        raise NotFoundError("Execução não encontrada.")
    return {"id": row["id"], "suite": row["suite"], "status": row["status"], "error_message": row["error_message"]}
