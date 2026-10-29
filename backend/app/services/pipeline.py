"""Orquestração do pipeline RAG: componentes, consistência do índice e resposta a perguntas.

Fluxo de uma pergunta:
pergunta → verificação de instruções maliciosas → embeddings → busca vetorial (top-k,
limiar, filtros) → avaliação de suficiência da evidência → geração → validação das
citações → resposta com fontes rastreáveis.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from pathlib import Path

from app.core.config import Settings
from app.core.logging import fingerprint_text
from app.repositories.database import Database
from app.repositories.documents import DocumentRepository, now_iso
from app.repositories.records import ChatRepository, IngestionRunRepository
from app.schemas.models import (
    ChatFilters,
    ChatResponse,
    GenerationInfo,
    IndexStatus,
    Latency,
    RetrievalInfo,
    RetrievedCandidate,
)
from app.services import citations as cit
from app.services.embeddings import (
    EmbeddingProvider,
    EmbeddingUnavailableError,
    build_embedding_provider,
    content_terms,
)
from app.services.evidence import TermStatistics, detect_conflicts, sentence_score, split_sentences, weighted_coverage
from app.services.generation import EvidenceSource, GenerationUnavailableError, Generator, build_generator
from app.services.ingestion import IngestionService
from app.services.retrieval import RetrievalResult, retrieve
from app.services.safety import detect_injection, scrub_secrets
from app.services.vector_store import METRIC, IndexIncompatibleError, build_vector_store

logger = logging.getLogger("acervo.pipeline")

MESSAGES = {
    "no_documents": "Seu acervo ainda não tem documentos processados. Adicione documentos e execute a indexação para começar.",
    "index_unavailable": "O índice de busca não está disponível no momento. Consulte a tela de documentos para reindexar.",
    "blocked": (
        "A pergunta contém instruções para alterar as regras do assistente ou obter informações protegidas. "
        "Essas instruções foram ignoradas. Reformule a pergunta sobre o conteúdo dos documentos."
    ),
    "insufficient_evidence": "Não encontrei evidências suficientes nos documentos disponíveis para responder com segurança.",
    "out_of_scope": "A pergunta parece estar fora do escopo do acervo atual; não é possível respondê-la com os documentos disponíveis.",
    "provider_error": "O provedor de IA está indisponível. Os trechos recuperados estão listados abaixo para consulta direta.",
}


class RagPipeline:
    def __init__(
        self,
        settings: Settings,
        *,
        data_dir: Path,
        sources: list[tuple[str, Path]],
        embedder: EmbeddingProvider | None = None,
        generator: Generator | None = None,
        name: str = "principal",
    ):
        self.settings = settings
        self.name = name
        self.data_dir = data_dir
        self.sources = sources
        self.db = Database(data_dir / "database" / "acervo.sqlite3")
        self.documents = DocumentRepository(self.db)
        self.ingestion_runs = IngestionRunRepository(self.db)
        self.chat = ChatRepository(self.db)
        self.vector_store = build_vector_store(settings.vector_store, data_dir / "indexes")
        self._embedder = embedder
        self.embedder_error: str | None = None
        self.generator = generator or build_generator(settings)
        self.ingestion = IngestionService(self)
        self.index_compatible = True
        self.index_message: str | None = None
        self._stats_lock = threading.Lock()
        self._term_stats: tuple[int, TermStatistics] | None = None
        self._version = 0

    # Componentes ---------------------------------------------------------------
    @property
    def embedder(self) -> EmbeddingProvider:
        return self.ensure_embedder()

    def ensure_embedder(self) -> EmbeddingProvider:
        if self._embedder is None:
            try:
                self._embedder = build_embedding_provider(
                    self.settings.embedding_provider, self.settings.embedding_model,
                    cache_dir=self.settings.embedding_cache_dir, hashing_dim=self.settings.hashing_dim,
                )
                self.embedder_error = None
            except EmbeddingUnavailableError as exc:
                self.embedder_error = str(exc)
                raise
        return self._embedder

    @property
    def embedder_fingerprint(self) -> str:
        return self.embedder.fingerprint

    def bump(self) -> None:
        self._version += 1

    # Parâmetros efetivos (variáveis de ambiente + ajustes validados em tempo de execução)
    def overrides(self) -> dict:
        raw = self.db.get_kv("settings_overrides")
        return json.loads(raw) if raw else {}

    def set_overrides(self, values: dict) -> None:
        current = self.overrides()
        current.update({k: v for k, v in values.items() if v is not None})
        self.db.set_kv("settings_overrides", json.dumps(current))

    def effective_params(self) -> dict:
        params = {
            "chunk_size": self.settings.chunk_size,
            "chunk_overlap": self.settings.chunk_overlap,
            "top_k": self.settings.top_k,
            "similarity_threshold": self.settings.similarity_threshold,
        }
        params.update(self.overrides())
        return params

    def chunk_params_signature(self) -> str:
        p = self.effective_params()
        return f"size={p['chunk_size']};overlap={p['chunk_overlap']};min={self.settings.min_chunk_chars}"

    # Índice ----------------------------------------------------------------------
    def startup(self) -> None:
        self.ingestion_runs.mark_stale_running_as_failed()
        try:
            self.ensure_embedder()
        except EmbeddingUnavailableError:
            logger.error("embeddings_indisponiveis", extra={"pipeline": self.name})
        self.load_index()

    def load_index(self) -> None:
        try:
            loaded = self.vector_store.load()
        except (IndexIncompatibleError, RuntimeError, OSError) as exc:
            logger.error("indice_corrompido", extra={"erro": str(exc)[:200]})
            loaded = False
        if self._embedder is None:
            self.index_compatible = False
            self.index_message = "Modelo de embeddings indisponível: " + (self.embedder_error or "erro desconhecido")
            return
        fingerprint, dim = self._embedder.fingerprint, self._embedder.dim
        if loaded and self.vector_store.fingerprint != fingerprint:
            self.index_compatible = False
            self.index_message = (
                f"O índice salvo foi criado com '{self.vector_store.fingerprint}', diferente do modelo atual "
                f"'{fingerprint}'. Execute a reindexação completa."
            )
            return
        if not loaded:
            self.vector_store.reset(fingerprint, dim)
        self.index_compatible, self.index_message = True, None
        self.verify_consistency(repair=True)

    def verify_consistency(self, *, repair: bool) -> bool:
        rows = self.documents.indexed_chunk_rows()
        expected = {int(r["vector_id"]) for r in rows}
        actual = self.vector_store.ids()
        if expected == actual:
            return True
        logger.warning("indice_inconsistente", extra={"esperado": len(expected), "atual": len(actual)})
        if repair:
            self.rebuild_vectors(rows)
            return True
        return False

    def rebuild_vectors(self, rows=None) -> None:
        """Reconstrói o índice vetorial a partir dos trechos salvos no SQLite (recuperação após falhas)."""
        rows = rows if rows is not None else self.documents.indexed_chunk_rows()
        embedder = self.embedder
        self.vector_store.reset(embedder.fingerprint, embedder.dim)
        batch = 256
        for i in range(0, len(rows), batch):
            part = rows[i:i + batch]
            vectors = embedder.embed_documents([r["text"] for r in part])
            self.vector_store.add([int(r["vector_id"]) for r in part], vectors)
        self.vector_store.save()
        self.bump()

    def reset_index(self) -> None:
        embedder = self.embedder
        self.vector_store.reset(embedder.fingerprint, embedder.dim)
        self.index_compatible, self.index_message = True, None
        self.bump()

    def remove_document_data(self, document_id: str) -> tuple[int, int]:
        vector_ids = self.documents.chunk_vector_ids(document_id)
        removed_vectors = self.vector_store.remove(vector_ids)
        removed_chunks = self.documents.delete_chunks(document_id)
        if vector_ids:
            self.vector_store.save()
        self.bump()
        return removed_vectors, removed_chunks

    def index_status(self) -> IndexStatus:
        chunks = self.documents.total_chunks()
        vectors = self.vector_store.count()
        current = None
        semantic = None
        if self._embedder is not None:
            current, semantic = self._embedder.fingerprint, self._embedder.semantic
        return IndexStatus(
            backend=self.vector_store.backend,
            metric=METRIC,
            vectors=vectors,
            chunks_in_database=chunks,
            consistent=vectors == chunks,
            compatible=self.index_compatible,
            embedding_fingerprint=self.vector_store.fingerprint,
            current_embedding_fingerprint=current,
            embedding_semantic=semantic,
            message=self.index_message,
        )

    def term_stats(self) -> TermStatistics:
        with self._stats_lock:
            key = self._version * 1_000_003 + self.vector_store.count()
            if self._term_stats is None or self._term_stats[0] != key:
                texts = [r["text"] for r in self.documents.indexed_chunk_rows()]
                self._term_stats = (key, TermStatistics(texts))
            return self._term_stats[1]

    # Perguntas ---------------------------------------------------------------------
    def answer(
        self,
        question: str,
        *,
        conversation_id: str | None = None,
        filters: ChatFilters | None = None,
        top_k: int | None = None,
        persist: bool = True,
    ) -> ChatResponse:
        started = time.perf_counter()
        params = self.effective_params()
        top_k = top_k or int(params["top_k"])
        threshold = float(params["similarity_threshold"])
        conversation_id = conversation_id or f"conv_{uuid.uuid4().hex[:12]}"
        generation_info = GenerationInfo(
            provider=self.generator.provider, model=self.generator.model,
            mode=self.generator.mode, is_llm=self.generator.is_llm,
        )
        logger.info("pergunta", extra={"q_hash": fingerprint_text(question), "q_len": len(question), "pipeline": self.name})

        def finish(status, evidence_status, *, answer=None, notice=None, citations=None, retrieval=None,
                   generation_ms=None, warnings=None, citations_valid=True, gen_info=None) -> ChatResponse:
            response = ChatResponse(
                interaction_id=f"int_{uuid.uuid4().hex[:16]}",
                conversation_id=conversation_id,
                question=question,
                status=status,
                evidence_status=evidence_status,
                answer=answer,
                notice=notice,
                citations=citations or [],
                citations_valid=citations_valid,
                warnings=warnings or [],
                retrieval=retrieval,
                generation=gen_info or generation_info,
                latency=Latency(
                    retrieval_ms=round(retrieval_ms, 2) if retrieval_ms is not None else None,
                    generation_ms=round(generation_ms, 2) if generation_ms is not None else None,
                    total_ms=round((time.perf_counter() - started) * 1000, 2),
                ),
                created_at=now_iso(),
            )
            if persist:
                self.chat.save(response)
            return response

        retrieval_ms = None
        no_gen = GenerationInfo(provider=self.generator.provider, model=self.generator.model, mode="none",
                                is_llm=self.generator.is_llm)

        # 1. Instruções maliciosas na pergunta: não executamos e não consultamos o modelo.
        injection = detect_injection(question)
        if injection:
            return finish("blocked", "none", notice=MESSAGES["blocked"], gen_info=no_gen,
                          warnings=["Padrões de instrução maliciosa detectados na pergunta."])

        # 2. Acervo vazio ou índice indisponível.
        if self.documents.counts().get("processed", 0) == 0:
            return finish("no_documents", "none", notice=MESSAGES["no_documents"], gen_info=no_gen)
        if not self.index_compatible or self._embedder is None:
            return finish("index_unavailable", "none", notice=self.index_message or MESSAGES["index_unavailable"],
                          gen_info=no_gen)

        # 3. Recuperação.
        result = retrieve(
            question, embedder=self.embedder, store=self.vector_store, documents=self.documents,
            top_k=top_k, threshold=threshold, filters=filters,
        )
        retrieval_ms = result.latency_ms
        stats = self.term_stats()
        retrieval_info = self._retrieval_info(result)

        if not result.selected:
            coverage = weighted_coverage(question, [c.row["text"] for c in result.candidates], stats)
            status = "out_of_scope" if coverage.ratio < 0.25 else "insufficient_evidence"
            notice = MESSAGES[status]
            if result.best_score is not None:
                notice += f" (maior similaridade encontrada: {result.best_score:.2f}; limiar: {threshold:.2f})"
            return finish(status, "insufficient", notice=notice, retrieval=retrieval_info, gen_info=no_gen)

        # 4. Suficiência: cobertura ponderada dos termos da pergunta nos trechos selecionados.
        coverage = weighted_coverage(question, [c.row["text"] for c in result.selected], stats)
        warnings: list[str] = []
        if not self.generator.is_llm and coverage.ratio < self.settings.min_term_coverage:
            missing = ", ".join(coverage.missing_terms[:5])
            notice = MESSAGES["insufficient_evidence"]
            if missing:
                notice += f" Termos da pergunta sem correspondência nos trechos: {missing}."
            # Há trechos do domínio acima do limiar, mas o termo central não aparece: informação ausente.
            return finish("insufficient_evidence", "insufficient", notice=notice, retrieval=retrieval_info,
                          gen_info=no_gen)

        evidence_status = "sufficient"
        if result.best_score is not None and result.best_score < threshold + self.settings.weak_evidence_margin:
            evidence_status = "weak"

        # 5. Geração.
        sources = [
            EvidenceSource(
                label=cit.label_for(i), source_id=item.row["id"], document_title=item.title, page=item.row["page"],
                section=item.row["section"], text=item.row["text"], score=item.score,
                suspicious=bool(item.row["suspicious"]),
            )
            for i, item in enumerate(result.selected)
        ]
        by_label = {s.label: item for s, item in zip(sources, result.selected, strict=True)}
        if any(s.suspicious for s in sources):
            warnings.append("Um ou mais trechos recuperados contêm texto com formato de instrução; foram tratados apenas como dados.")
        try:
            output = self.generator.generate(question, sources, stats)
        except GenerationUnavailableError as exc:
            citations = [cit.build_citation(label, item, cited=False) for label, item in by_label.items()]
            return finish("provider_error", "none", notice=f"{exc.public_message} {MESSAGES['provider_error']}",
                          citations=citations, retrieval=retrieval_info, gen_info=generation_info)
        warnings += output.warnings
        if output.insufficient or output.out_of_scope:
            status = "out_of_scope" if output.out_of_scope else "insufficient_evidence"
            notice = MESSAGES[status]
            if output.text:
                notice += f" Detalhe: {output.text}"
            return finish(status, "insufficient", notice=notice, retrieval=retrieval_info,
                          generation_ms=output.latency_ms, warnings=warnings)

        # 6. Validação das citações e proteção contra vazamento de segredos.
        text, valid_labels, invalid_labels = cit.validate_and_clean(output.text, set(by_label))
        secrets = [s.get_secret_value() for s in (self.settings.llm_api_key, self.settings.admin_token) if s]
        text, leaked = scrub_secrets(text, secrets)
        if leaked:
            warnings.append("A resposta continha um valor protegido, que foi removido.")
        citations_valid = not invalid_labels and bool(valid_labels)
        notice = None
        if invalid_labels:
            warnings.append(f"Citações inexistentes removidas da resposta: {', '.join(invalid_labels)}.")
        if not valid_labels:
            notice = "A resposta não apresentou citações válidas; trate-a com cautela e confira os trechos recuperados."
        citations = [cit.build_citation(label, by_label[label], cited=True) for label in valid_labels]
        citations += [
            cit.build_citation(label, item, cited=False) for label, item in by_label.items() if label not in valid_labels
        ]

        # 7. Divergências entre fontes.
        conflicts = detect_conflicts(self._evidence_sentences(question, output, sources, stats))
        if conflicts:
            evidence_status = "conflicting"
            warnings += conflicts
            notice = (notice + " " if notice else "") + (
                "As fontes recuperadas apresentam possíveis divergências; compare os trechos antes de concluir."
            )
        elif evidence_status == "weak":
            notice = (notice + " " if notice else "") + (
                "A similaridade dos trechos com a pergunta está próxima do limiar mínimo; a evidência pode ser fraca."
            )
        return finish("answered", evidence_status, answer=text, notice=notice, citations=citations,
                      retrieval=retrieval_info, generation_ms=output.latency_ms, warnings=warnings,
                      citations_valid=citations_valid)

    def _evidence_sentences(self, question, output, sources: list[EvidenceSource], stats) -> dict[str, list[str]]:
        by_doc: dict[str, list[str]] = {}
        if output.used_sentences:
            titles = {s.label: s.document_title for s in sources}
            for label, sentences in output.used_sentences.items():
                by_doc.setdefault(titles[label], []).extend(sentences)
            return by_doc
        q_terms = list(dict.fromkeys(content_terms(question)))
        scored = [
            (sentence_score(q_terms, sent, stats), s.document_title, sent)
            for s in sources for sent in split_sentences(s.text)
        ]
        if not scored:
            return {}
        best = max(score for score, _, _ in scored)
        for score, title, sent in scored:
            if best > 0 and score >= best * 0.8:
                by_doc.setdefault(title, []).append(sent)
        return by_doc

    def _retrieval_info(self, result: RetrievalResult) -> RetrievalInfo:
        embedder = self.embedder
        return RetrievalInfo(
            top_k=result.top_k,
            similarity_threshold=result.threshold,
            metric=METRIC,
            filters=result.filters,
            candidates_considered=result.considered,
            selected=len(result.selected),
            best_score=round(result.best_score, 4) if result.best_score is not None else None,
            embedding_provider=embedder.name,
            embedding_model=embedder.model,
            embedding_semantic=embedder.semantic,
            candidates=[
                RetrievedCandidate(
                    source_id=c.row["id"], document_id=c.row["document_id"], document_title=c.title,
                    filename=c.row["filename"], page=c.row["page"], score=round(c.score, 4), selected=c.selected, reason=c.reason,
                )
                for c in result.candidates
            ],
        )

    def close(self) -> None:
        self.db.close()
