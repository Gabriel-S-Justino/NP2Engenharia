"""Ingestão idempotente: varredura, detecção de mudanças, chunking, embeddings e indexação.

Regras importantes:
* Arquivos originais nunca são alterados, renomeados ou apagados na pasta `Documentos/`.
* O hash SHA-256 identifica alterações e duplicatas; execuções repetidas não duplicam vetores.
* A falha em um documento é registrada e não interrompe os demais.
* Fontes: arquivos em pastas (ex.: `Documentos/`) e originais guardados no banco (uploads e, com Postgres,
  todo o acervo — necessário em serverless, onde não há disco persistente).
* Em serverless, cada execução tem um orçamento de tempo; documentos restantes ficam pendentes e são
  processados na próxima chamada (fila persistente no banco). Uma trava no banco impede execuções simultâneas
  entre instâncias.
"""

from __future__ import annotations

import hashlib
import json
import logging
import tempfile
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from app.repositories.database import now_iso
from app.schemas.models import IngestionRun
from app.services.chunking import chunk_pages
from app.services.document_loader import SUPPORTED_EXTENSIONS, DocumentReadError, load_document
from app.services.safety import looks_like_injection

if TYPE_CHECKING:
    from app.services.pipeline import RagPipeline

logger = logging.getLogger("acervo.ingestion")

IGNORED_NAMES = {"manifest.json", "manifest.example.json", "readme.md", ".gitkeep", ".ds_store", "thumbs.db", "desktop.ini"}
METADATA_FIELDS = (
    "title", "author", "institution", "published_date", "version", "url", "license", "subject", "reliability_notes",
)
LEASE_NAME = "ingestion"


def make_document_id(origin: str, relative_path: str) -> str:
    digest = hashlib.sha256(f"{origin}:{relative_path}".encode()).hexdigest()
    return f"doc_{digest[:12]}"


@dataclass
class DiscoveredFile:
    """Documento a ingerir: um arquivo em disco (`path`) ou um original guardado no banco (`stored=True`)."""

    origin: str
    root: Path | None
    path: Path | None
    relative_path: str
    stored: bool = False
    stored_sha: str | None = None
    stored_size: int | None = None

    @property
    def document_id(self) -> str:
        return make_document_id(self.origin, self.relative_path)

    @property
    def filename(self) -> str:
        return Path(self.relative_path).name

    @property
    def suffix(self) -> str:
        return Path(self.relative_path).suffix.lower()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def is_ignored(path: Path, root: Path) -> bool:
    rel_parts = path.relative_to(root).parts
    if any(part.startswith(".") for part in rel_parts):
        return True  # arquivos e pastas ocultos
    name = path.name.lower()
    if name in IGNORED_NAMES or name.startswith("~$") or name.startswith(".~lock") or name.endswith((".tmp", ".part", ".crdownload")):
        return True
    return path.suffix.lower() not in SUPPORTED_EXTENSIONS


def discover(origin: str, root: Path) -> tuple[list[DiscoveredFile], int]:
    """Varre a pasta recursivamente. Retorna (arquivos suportados, quantidade ignorada)."""
    if not root.exists():
        return [], 0
    found, skipped = [], 0
    root_resolved = root.resolve()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        # Proteção contra links/caminhos que escapam da pasta raiz.
        try:
            path.resolve().relative_to(root_resolved)
        except ValueError:
            skipped += 1
            continue
        if is_ignored(path, root):
            if path.name.lower() not in IGNORED_NAMES:
                skipped += 1
            continue
        found.append(DiscoveredFile(origin, root, path, path.relative_to(root).as_posix()))
    return found, skipped


def load_manifest(root: Path) -> dict:
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("manifesto_invalido", extra={"root": root.name})
        return {}
    documents = data.get("documents", {}) if isinstance(data, dict) else {}
    return documents if isinstance(documents, dict) else {}


def title_from_filename(filename: str) -> str:
    stem = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(stem.split()) or filename


def build_metadata(file: DiscoveredFile, manifest: dict, pdf_metadata: dict | None = None) -> dict:
    entry = manifest.get(file.relative_path) or {}
    metadata: dict = {}
    origin = None
    for field in METADATA_FIELDS:
        value = entry.get(field)
        if isinstance(value, str | int | float) and str(value).strip():
            metadata[field] = str(value).strip()
            origin = "manifesto"
    pdf_metadata = pdf_metadata or {}
    if "title" not in metadata and pdf_metadata.get("pdf_title"):
        metadata["title"], origin = pdf_metadata["pdf_title"], origin or "pdf"
    if "author" not in metadata and pdf_metadata.get("pdf_author"):
        metadata["author"], origin = pdf_metadata["pdf_author"], origin or "pdf"
    if "title" not in metadata:
        metadata["title"] = title_from_filename(file.filename)
        origin = origin or "inferido do nome do arquivo"
    metadata["metadata_origin"] = origin
    return metadata


class IngestionService:
    def __init__(self, pipeline: RagPipeline):
        self.pipeline = pipeline
        self._lock = threading.Lock()
        self.current: IngestionRun | None = None
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        """Há execução nesta instância ou em outra (trava no banco)?"""
        return self.current is not None or self.pipeline.db.lease_active(LEASE_NAME)

    # API pública --------------------------------------------------------------
    def start(self, kind: str = "scan", *, force: bool = False, document_ids: list[str] | None = None,
              wait: bool = False, time_budget: float | None = None) -> IngestionRun:
        """Inicia uma execução. Em serverless é sempre síncrona e limitada a `INGESTION_TIME_BUDGET_SECONDS`."""
        from app.core.errors import ConflictError

        settings = self.pipeline.settings
        if settings.serverless:
            wait = True
            time_budget = time_budget or settings.ingestion_time_budget_seconds
        lease_ttl = (time_budget or 3600) + 120
        if not self._lock.acquire(blocking=False):
            raise ConflictError("Já existe uma indexação em andamento. Aguarde a conclusão.", code="ingestao_em_andamento")
        if not self.pipeline.db.try_acquire_lease(LEASE_NAME, lease_ttl):
            self._lock.release()
            raise ConflictError("Já existe uma indexação em andamento. Aguarde a conclusão.", code="ingestao_em_andamento")
        run = self.pipeline.ingestion_runs.start(kind)
        self.current = run

        def target() -> None:
            try:
                self._run(run, force=force, document_ids=document_ids, time_budget=time_budget)
            finally:
                self.current = None
                self.pipeline.db.release_lease(LEASE_NAME)
                self._lock.release()

        if wait:
            target()
        else:
            self._thread = threading.Thread(target=target, name=f"ingestion-{run.id}", daemon=True)
            self._thread.start()
        return run

    def join(self, timeout: float | None = None) -> None:
        if self._thread:
            self._thread.join(timeout)

    # Implementação -------------------------------------------------------------
    def _discover_all(self, run: IngestionRun) -> tuple[list[DiscoveredFile], dict[str, dict]]:
        pipeline = self.pipeline
        discovered: list[DiscoveredFile] = []
        manifests: dict[str, dict] = {}
        for origin, root in pipeline.sources:
            files, skipped = discover(origin, root)
            discovered += files
            run.stats.skipped += skipped
            manifests[origin] = load_manifest(root)
        # Originais guardados no banco que não estão (ou não estão mais) em disco nesta máquina/deploy.
        on_disk = {f.document_id for f in discovered}
        for row in pipeline.documents.stored_documents():
            if row["id"] in on_disk or row["origin"] not in pipeline.origins:
                continue
            discovered.append(
                DiscoveredFile(row["origin"], None, None, row["relative_path"], stored=True,
                               stored_sha=row["file_sha"], stored_size=int(row["file_size"]))
            )
        run.stats.scanned = len(discovered)
        return discovered, manifests

    def _prune_missing(self, discovered: list[DiscoveredFile], run: IngestionRun) -> None:
        """Remove do banco documentos de pastas cujo arquivo sumiu (somente quando PRUNE_MISSING_FILES)."""
        pipeline = self.pipeline
        if not pipeline.settings.prune_missing_files:
            return
        present = {f.document_id for f in discovered}
        for origin, _root in pipeline.sources:
            for row in pipeline.documents.all_rows(origin):
                if row["id"] not in present:
                    pipeline.remove_document_data(row["id"])
                    pipeline.documents.delete(row["id"])
                    run.stats.removed += 1

    def _mark_for_reprocessing(self, document_ids: list[str] | None) -> None:
        """Reindexação: marca os documentos como pendentes (fila persistente) em vez de exigir tudo de uma vez."""
        pipeline = self.pipeline
        rows = pipeline.documents.all_rows()
        targets = [r for r in rows if (document_ids is None and r["status"] != "excluded")
                   or (document_ids is not None and r["id"] in document_ids)]
        for row in targets:
            pipeline.documents.set_status(row["id"], "pending")
            pipeline.db.delete_kv(f"chunk_params:{row['id']}")

    def _run(self, run: IngestionRun, *, force: bool, document_ids: list[str] | None,
             time_budget: float | None) -> None:
        pipeline = self.pipeline
        stats = run.stats
        started = time.monotonic()
        try:
            pipeline.ensure_ready(for_ingestion=True)
            if not force and not pipeline.index_compatible:
                raise RuntimeError(pipeline.index_message or "Índice incompatível: execute a reindexação completa.")
            if force:
                if not document_ids:
                    pipeline.reset_index()
                self._mark_for_reprocessing(document_ids)
            discovered, manifests = self._discover_all(run)
            self._prune_missing(discovered, run)

            params_signature = pipeline.chunk_params_signature()
            to_process: list[tuple[DiscoveredFile, str, str | None]] = []
            for file in discovered:
                row = pipeline.documents.get_row(file.document_id)
                if document_ids and file.document_id not in document_ids:
                    stats.unchanged += 1 if row else 0
                    continue
                sha = file.stored_sha if file.stored else sha256_file(file.path)
                if row and row["status"] == "excluded" and not document_ids:
                    stats.skipped += 1
                    continue
                unchanged = (
                    row is not None
                    and row["sha256"] == sha
                    and row["status"] == "processed"
                    and row["embedding_fingerprint"] == pipeline.embedder_fingerprint
                    and pipeline.db.get_kv(f"chunk_params:{file.document_id}") == params_signature
                )
                if unchanged:
                    stats.unchanged += 1
                    continue
                to_process.append((file, sha, row["status"] if row else None))
            stats.to_process = len(to_process)
            pipeline.ingestion_runs.update(run)

            for file, sha, previous_status in to_process:
                over_budget = time_budget is not None and time.monotonic() - started > time_budget
                if over_budget and stats.processed_so_far > 0:
                    break  # orçamento esgotado: o restante continua pendente (ao menos 1 documento por execução)
                self._process_file(file, sha, previous_status, manifests.get(file.origin, {}), run)
                stats.processed_so_far += 1
                pipeline.ingestion_runs.update(run)
            stats.remaining = stats.to_process - stats.processed_so_far

            pipeline.vector_store.save()
            pipeline.db.set_kv("last_ingestion_at", now_iso())
            run.status = "completed"
        except Exception as exc:  # noqa: BLE001 - registrar a falha geral da execução
            logger.exception("ingestao_falhou")
            run.status = "failed"
            run.error_message = getattr(exc, "public_message", None) or str(exc)[:300]
        finally:
            run.finished_at = now_iso()
            pipeline.ingestion_runs.update(run)
            pipeline.bump()

    def _read_content(self, file: DiscoveredFile) -> bytes:
        if file.stored:
            content = self.pipeline.documents.load_file(file.document_id)
            if content is None:
                raise DocumentReadError("O arquivo original não está mais armazenado.")
            return content
        return file.path.read_bytes()

    def _process_file(self, file: DiscoveredFile, sha: str, previous_status: str | None, manifest: dict,
                      run: IngestionRun) -> None:
        pipeline = self.pipeline
        stats = run.stats
        file_type = file.suffix.lstrip(".")
        metadata = build_metadata(file, manifest)
        existing = pipeline.documents.get_row(file.document_id)
        previous_metadata = json.loads(existing["metadata_json"]) if existing and existing["metadata_json"] else None
        if file.stored:
            # Original vindo do banco: preserva os metadados já registrados (upload ou ingestão anterior).
            size = file.stored_size or 0
            modified = existing["file_modified_at"] if existing else now_iso()
            if previous_metadata:
                metadata = previous_metadata
        else:
            stat = file.path.stat()
            size = stat.st_size
            modified = datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(timespec="seconds")

        duplicate = pipeline.documents.find_by_sha(sha, exclude_id=file.document_id)
        pipeline.documents.upsert(
            document_id=file.document_id, origin=file.origin, relative_path=file.relative_path,
            filename=file.filename, file_type=file_type, size_bytes=size, sha256=sha,
            status="processing", metadata=metadata, file_modified_at=modified,
        )
        if duplicate is not None and duplicate["status"] in ("processed", "processing", "pending"):
            pipeline.remove_document_data(file.document_id)
            pipeline.documents.set_status(
                file.document_id, "excluded",
                error=f"Conteúdo idêntico a '{duplicate['filename']}'; ignorado para evitar indexação duplicada.",
            )
            stats.skipped += 1
            return
        try:
            content = self._read_content(file)
            if not file.stored and pipeline.settings.store_originals_in_db \
                    and pipeline.documents.stored_file_sha(file.document_id) != sha:
                pipeline.documents.save_file(file.document_id, content, sha)
            with tempfile.TemporaryDirectory() as tmp:
                local = Path(tmp) / f"documento{file.suffix}"
                local.write_bytes(content)
                loaded = load_document(local, ocr_enabled=pipeline.settings.ocr_enabled)
            if not (file.stored and previous_metadata):
                metadata = build_metadata(file, manifest, loaded.metadata)
            pipeline.documents.update_metadata(file.document_id, metadata)
            params = pipeline.effective_params()
            chunks = chunk_pages(
                file.document_id, loaded.pages, chunk_size=params["chunk_size"],
                chunk_overlap=params["chunk_overlap"], min_chunk_chars=pipeline.settings.min_chunk_chars,
            )
            if not chunks:
                raise DocumentReadError(
                    "Nenhum texto extraível foi encontrado. Se for um PDF digitalizado, habilite o OCR (OCR_ENABLED)."
                )
            suspicious = [looks_like_injection(c.text) for c in chunks]
            warnings = list(loaded.warnings)
            if any(suspicious):
                warnings.append(
                    f"{sum(suspicious)} trecho(s) contêm texto com formato de instrução ao assistente; "
                    "serão tratados apenas como dados e ignorados como comandos."
                )
            vectors = pipeline.embedder.embed_documents([c.text for c in chunks])
            pipeline.remove_document_data(file.document_id)
            vector_ids = pipeline.documents.replace_chunks(file.document_id, chunks, suspicious)
            pipeline.vector_store.add(vector_ids, vectors)
            pipeline.documents.mark_processed(
                file.document_id, page_count=loaded.page_count, chunk_count=len(chunks), warnings=warnings,
                fingerprint=pipeline.embedder_fingerprint,
            )
            pipeline.db.set_kv(f"chunk_params:{file.document_id}", pipeline.chunk_params_signature())
            stats.chunks_indexed += len(chunks)
            if previous_status is None:
                stats.new += 1
            else:
                stats.updated += 1
        except DocumentReadError as exc:
            pipeline.remove_document_data(file.document_id)
            pipeline.documents.mark_failed(file.document_id, str(exc))
            stats.failed += 1
        except Exception:  # noqa: BLE001
            logger.exception("falha_documento", extra={"document_id": file.document_id})
            pipeline.remove_document_data(file.document_id)
            pipeline.documents.mark_failed(file.document_id, "Erro inesperado ao processar o documento.")
            stats.failed += 1
