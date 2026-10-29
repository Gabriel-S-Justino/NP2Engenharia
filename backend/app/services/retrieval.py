"""Recuperação semântica com limiar, top-k e filtros por metadados.

Métrica: similaridade de cosseno (−1 a 1). O limiar é aplicado à similaridade;
não há conversão para "probabilidade". O valor padrão (SIMILARITY_THRESHOLD) deve ser
calibrado para cada modelo de embeddings com `scripts/calibrate_threshold.py`.
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass, field

from app.repositories.documents import DocumentRepository
from app.schemas.models import ChatFilters
from app.services.embeddings import EmbeddingProvider
from app.services.vector_store import VectorStore


@dataclass
class RetrievedChunk:
    vector_id: int
    score: float
    row: sqlite3.Row
    selected: bool = False
    reason: str | None = None

    @property
    def metadata(self) -> dict:
        return json.loads(self.row["metadata_json"] or "{}")

    @property
    def title(self) -> str:
        return self.metadata.get("title") or self.row["filename"]


@dataclass
class RetrievalResult:
    selected: list[RetrievedChunk]
    candidates: list[RetrievedChunk]
    best_score: float | None
    latency_ms: float
    considered: int
    filters: ChatFilters | None = None
    top_k: int = 5
    threshold: float = 0.0
    notes: list[str] = field(default_factory=list)


def _passes_filters(row: sqlite3.Row, filters: ChatFilters | None) -> bool:
    if row["doc_status"] != "processed":
        return False
    if not filters:
        return True
    if filters.document_ids and row["document_id"] not in filters.document_ids:
        return False
    if filters.file_types and row["file_type"] not in {t.lower().lstrip(".") for t in filters.file_types}:
        return False
    if filters.subject:
        subject = (json.loads(row["metadata_json"] or "{}").get("subject") or "").lower()
        if filters.subject.lower() not in subject:
            return False
    return True


def retrieve(
    question: str,
    *,
    embedder: EmbeddingProvider,
    store: VectorStore,
    documents: DocumentRepository,
    top_k: int,
    threshold: float,
    filters: ChatFilters | None = None,
) -> RetrievalResult:
    start = time.perf_counter()
    query_vector = embedder.embed_query(question)
    total = store.count()
    k_search = min(total, max(top_k * 4, 20)) if not filters else total
    hits = store.search(query_vector, k_search) if total else []
    rows = documents.chunks_by_vector_ids([vid for vid, _ in hits])

    candidates: list[RetrievedChunk] = []
    selected: list[RetrievedChunk] = []
    best: float | None = None
    for vector_id, score in hits:
        row = rows.get(vector_id)
        if row is None:
            continue  # vetor órfão (deveria ter sido removido); ignorado com segurança
        item = RetrievedChunk(vector_id=vector_id, score=score, row=row)
        if not _passes_filters(row, filters):
            continue
        best = score if best is None else max(best, score)
        if score < threshold:
            item.reason = "abaixo do limiar de similaridade"
        elif len(selected) >= top_k:
            item.reason = "fora do top-k"
        else:
            item.selected = True
            selected.append(item)
        if len(candidates) < max(top_k * 2, 10):
            candidates.append(item)
    return RetrievalResult(
        selected=selected,
        candidates=candidates,
        best_score=best,
        latency_ms=(time.perf_counter() - start) * 1000,
        considered=len(hits),
        filters=filters,
        top_k=top_k,
        threshold=threshold,
    )
