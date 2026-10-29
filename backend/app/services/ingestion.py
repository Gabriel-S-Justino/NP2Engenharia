"""Ingestão idempotente: varredura, detecção de mudanças, chunking, embeddings e indexação.

Regras importantes:
* Arquivos originais nunca são alterados, renomeados ou apagados na pasta `Documentos/`.
* O hash SHA-256 identifica alterações e duplicatas; execuções repetidas não duplicam vetores.
* A falha em um documento é registrada e não interrompe os demais.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from app.repositories.documents import now_iso
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


@dataclass
class DiscoveredFile:
    origin: str
    root: Path
    path: Path
    relative_path: str

    @property
    def document_id(self) -> str:
        digest = hashlib.sha256(f"{self.origin}:{self.relative_path}".encode()).hexdigest()
        return f"doc_{digest[:12]}"


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
        metadata["title"] = title_from_filename(file.path.name)
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
        return self.current is not None

    # API pública --------------------------------------------------------------
    def start(self, kind: str = "scan", *, force: bool = False, document_ids: list[str] | None = None,
              wait: bool = False) -> IngestionRun:
        if not self._lock.acquire(blocking=False):
            from app.core.errors import ConflictError

            raise ConflictError("Já existe uma indexação em andamento. Aguarde a conclusão.", code="ingestao_em_andamento")
        run = self.pipeline.ingestion_runs.start(kind)
        self.current = run

        def target() -> None:
            try:
                self._run(run, force=force, document_ids=document_ids)
            finally:
                self.current = None
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
    def _run(self, run: IngestionRun, *, force: bool, document_ids: list[str] | None) -> None:
        pipeline = self.pipeline
        stats = run.stats
        try:
            pipeline.ensure_embedder()
            if force and not document_ids:
                pipeline.reset_index()
            discovered: list[DiscoveredFile] = []
            manifests: dict[str, dict] = {}
            for origin, root in pipeline.sources:
                files, skipped = discover(origin, root)
                discovered += files
                stats.skipped += skipped
                manifests[origin] = load_manifest(root)
            stats.scanned = len(discovered)

            # Arquivos removidos do disco: limpa banco e vetores (o arquivo já não existe).
            present = {f.document_id for f in discovered}
            for origin, _root in pipeline.sources:
                for row in pipeline.documents.all_rows(origin):
                    if row["id"] not in present:
                        pipeline.remove_document_data(row["id"])
                        pipeline.documents.delete(row["id"])
                        stats.removed += 1

            params_signature = pipeline.chunk_params_signature()
            to_process: list[tuple[DiscoveredFile, str, str | None]] = []
            for file in discovered:
                row = pipeline.documents.get_row(file.document_id)
                if document_ids and file.document_id not in document_ids:
                    stats.unchanged += 1 if row else 0
                    continue
                sha = sha256_file(file.path)
                if row and row["status"] == "excluded" and not document_ids:
                    stats.skipped += 1
                    continue
                unchanged = (
                    row is not None
                    and row["sha256"] == sha
                    and row["status"] == "processed"
                    and row["embedding_fingerprint"] == pipeline.embedder_fingerprint
                    and pipeline.db.get_kv(f"chunk_params:{file.document_id}") == params_signature
                    and not force
                )
                if unchanged:
                    stats.unchanged += 1
                    continue
                to_process.append((file, sha, row["status"] if row else None))
            stats.to_process = len(to_process)
            pipeline.ingestion_runs.update(run)

            for file, sha, previous_status in to_process:
                self._process_file(file, sha, previous_status, manifests.get(file.origin, {}), run)
                stats.processed_so_far += 1
                pipeline.ingestion_runs.update(run)

            pipeline.vector_store.save()
            pipeline.db.set_kv("last_ingestion_at", now_iso())
            run.status = "completed"
        except Exception as exc:  # noqa: BLE001 - registrar a falha geral da execução
            logger.exception("ingestao_falhou")
            run.status = "failed"
            run.error_message = getattr(exc, "public_message", None) or str(exc)[:300]
        finally:
            run.finished_at = datetime.now(UTC).isoformat(timespec="seconds")
            pipeline.ingestion_runs.update(run)

    def _process_file(self, file: DiscoveredFile, sha: str, previous_status: str | None, manifest: dict,
                      run: IngestionRun) -> None:
        pipeline = self.pipeline
        stats = run.stats
        stat = file.path.stat()
        file_type = file.path.suffix.lower().lstrip(".")
        metadata = build_metadata(file, manifest)

        duplicate = pipeline.documents.find_by_sha(sha, exclude_id=file.document_id)
        pipeline.documents.upsert(
            document_id=file.document_id, origin=file.origin, relative_path=file.relative_path,
            filename=file.path.name, file_type=file_type, size_bytes=stat.st_size, sha256=sha,
            status="processing", metadata=metadata,
            file_modified_at=datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(timespec="seconds"),
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
            loaded = load_document(file.path, ocr_enabled=pipeline.settings.ocr_enabled)
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
