"""Repositório de documentos e trechos."""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime

from app.repositories.database import Database
from app.schemas.models import ChunkOut, DocumentSummary, SourceMetadata
from app.services.chunking import Chunk


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def row_to_document(row: sqlite3.Row) -> DocumentSummary:
    metadata = json.loads(row["metadata_json"] or "{}")
    return DocumentSummary(
        id=row["id"],
        filename=row["filename"],
        relative_path=row["relative_path"],
        origin=row["origin"],
        file_type=row["file_type"],
        size_bytes=row["size_bytes"],
        status=row["status"],
        error_message=row["error_message"],
        page_count=row["page_count"],
        chunk_count=row["chunk_count"],
        metadata=SourceMetadata(**{k: v for k, v in metadata.items() if k in SourceMetadata.model_fields}),
        warnings=json.loads(row["warnings_json"] or "[]"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        indexed_at=row["indexed_at"],
    )


def row_to_chunk(row: sqlite3.Row) -> ChunkOut:
    return ChunkOut(
        id=row["id"],
        document_id=row["document_id"],
        ordinal=row["ordinal"],
        page=row["page"],
        section=row["section"],
        text=row["text"],
        char_start=row["char_start"],
        char_end=row["char_end"],
        suspicious=bool(row["suspicious"]),
    )


class DocumentRepository:
    def __init__(self, db: Database):
        self.db = db

    # Documentos -------------------------------------------------------------
    def get_row(self, document_id: str) -> sqlite3.Row | None:
        return self.db.query_one("SELECT * FROM documents WHERE id = ?", (document_id,))

    def get(self, document_id: str) -> DocumentSummary | None:
        row = self.get_row(document_id)
        return row_to_document(row) if row else None

    def get_by_path(self, origin: str, relative_path: str) -> sqlite3.Row | None:
        return self.db.query_one(
            "SELECT * FROM documents WHERE origin = ? AND relative_path = ?", (origin, relative_path)
        )

    def find_by_sha(self, sha256: str, *, exclude_id: str | None = None) -> sqlite3.Row | None:
        return self.db.query_one(
            "SELECT * FROM documents WHERE sha256 = ? AND status != 'excluded' AND id != ? ORDER BY created_at LIMIT 1",
            (sha256, exclude_id or ""),
        )

    def all_rows(self, origin: str | None = None) -> list[sqlite3.Row]:
        if origin:
            return self.db.query("SELECT * FROM documents WHERE origin = ? ORDER BY relative_path", (origin,))
        return self.db.query("SELECT * FROM documents ORDER BY relative_path")

    def list(
        self,
        *,
        page: int,
        page_size: int,
        status: str | None = None,
        search: str | None = None,
        file_type: str | None = None,
        sort: str = "name",
    ) -> tuple[list[DocumentSummary], int]:
        where, params = [], []
        if status:
            where.append("status = ?")
            params.append(status)
        if file_type:
            where.append("file_type = ?")
            params.append(file_type)
        if search:
            where.append("(filename LIKE ? OR metadata_json LIKE ?)")
            like = f"%{search}%"
            params += [like, like]
        clause = f"WHERE {' AND '.join(where)}" if where else ""
        order = {
            "name": "filename COLLATE NOCASE ASC",
            "updated": "updated_at DESC",
            "status": "status ASC, filename COLLATE NOCASE ASC",
            "size": "size_bytes DESC",
        }.get(sort, "filename COLLATE NOCASE ASC")
        total = int(self.db.scalar(f"SELECT COUNT(*) FROM documents {clause}", params))
        rows = self.db.query(
            f"SELECT * FROM documents {clause} ORDER BY {order} LIMIT ? OFFSET ?",
            [*params, page_size, (page - 1) * page_size],
        )
        return [row_to_document(r) for r in rows], total

    def upsert(
        self,
        *,
        document_id: str,
        origin: str,
        relative_path: str,
        filename: str,
        file_type: str,
        size_bytes: int,
        sha256: str,
        status: str,
        metadata: dict,
        file_modified_at: str | None,
    ) -> None:
        ts = now_iso()
        self.db.execute(
            """
            INSERT INTO documents(id, relative_path, origin, filename, file_type, size_bytes, sha256, status,
                                  metadata_json, created_at, updated_at, file_modified_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                size_bytes = excluded.size_bytes, sha256 = excluded.sha256, status = excluded.status,
                metadata_json = excluded.metadata_json, updated_at = excluded.updated_at,
                file_modified_at = excluded.file_modified_at, error_message = NULL
            """,
            (document_id, relative_path, origin, filename, file_type, size_bytes, sha256, status,
             json.dumps(metadata, ensure_ascii=False), ts, ts, file_modified_at),
        )

    def update_metadata(self, document_id: str, metadata: dict) -> None:
        self.db.execute(
            "UPDATE documents SET metadata_json = ? WHERE id = ?",
            (json.dumps(metadata, ensure_ascii=False), document_id),
        )

    def set_status(self, document_id: str, status: str, *, error: str | None = None) -> None:
        self.db.execute(
            "UPDATE documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?",
            (status, error, now_iso(), document_id),
        )

    def mark_processed(
        self, document_id: str, *, page_count: int | None, chunk_count: int, warnings: list[str], fingerprint: str
    ) -> None:
        ts = now_iso()
        self.db.execute(
            """UPDATE documents SET status = 'processed', error_message = NULL, page_count = ?, chunk_count = ?,
               warnings_json = ?, embedding_fingerprint = ?, indexed_at = ?, updated_at = ? WHERE id = ?""",
            (page_count, chunk_count, json.dumps(warnings, ensure_ascii=False), fingerprint, ts, ts, document_id),
        )

    def mark_failed(self, document_id: str, error: str, warnings: list[str] | None = None) -> None:
        self.db.execute(
            """UPDATE documents SET status = 'failed', error_message = ?, chunk_count = 0, warnings_json = ?,
               updated_at = ? WHERE id = ?""",
            (error, json.dumps(warnings or [], ensure_ascii=False), now_iso(), document_id),
        )

    def delete(self, document_id: str) -> None:
        self.db.execute("DELETE FROM documents WHERE id = ?", (document_id,))

    def counts(self) -> dict[str, int]:
        rows = self.db.query("SELECT status, COUNT(*) AS n FROM documents GROUP BY status")
        return {row["status"]: int(row["n"]) for row in rows}

    def last_indexed_at(self) -> str | None:
        return self.db.scalar("SELECT MAX(indexed_at) FROM documents WHERE status = 'processed'")

    # Chunks ------------------------------------------------------------------
    def replace_chunks(self, document_id: str, chunks: list[Chunk], suspicious: list[bool]) -> list[int]:
        """Substitui os chunks de um documento e retorna os vector_ids criados (na ordem)."""
        vector_ids: list[int] = []
        with self.db.transaction() as conn:
            conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
            for chunk, flag in zip(chunks, suspicious, strict=True):
                cursor = conn.execute(
                    """INSERT INTO chunks(id, document_id, ordinal, page, section, text, char_start, char_end,
                                          content_sha, suspicious) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (chunk.id, document_id, chunk.ordinal, chunk.page, chunk.section, chunk.text,
                     chunk.char_start, chunk.char_end, chunk.content_sha, int(flag)),
                )
                vector_ids.append(int(cursor.lastrowid))
        return vector_ids

    def chunk_vector_ids(self, document_id: str) -> list[int]:
        return [int(r[0]) for r in self.db.query("SELECT vector_id FROM chunks WHERE document_id = ?", (document_id,))]

    def delete_chunks(self, document_id: str) -> int:
        return self.db.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,)).rowcount

    def chunks_by_vector_ids(self, vector_ids: list[int]) -> dict[int, sqlite3.Row]:
        if not vector_ids:
            return {}
        placeholders = ",".join("?" * len(vector_ids))
        rows = self.db.query(
            f"""SELECT c.*, d.filename, d.metadata_json, d.origin, d.file_type, d.status AS doc_status
                FROM chunks c JOIN documents d ON d.id = c.document_id
                WHERE c.vector_id IN ({placeholders})""",
            vector_ids,
        )
        return {int(r["vector_id"]): r for r in rows}

    def get_chunk(self, chunk_id: str) -> sqlite3.Row | None:
        return self.db.query_one("SELECT * FROM chunks WHERE id = ?", (chunk_id,))

    def list_chunks(self, document_id: str, *, page: int, page_size: int) -> tuple[list[ChunkOut], int]:
        total = int(self.db.scalar("SELECT COUNT(*) FROM chunks WHERE document_id = ?", (document_id,)))
        rows = self.db.query(
            "SELECT * FROM chunks WHERE document_id = ? ORDER BY ordinal LIMIT ? OFFSET ?",
            (document_id, page_size, (page - 1) * page_size),
        )
        return [row_to_chunk(r) for r in rows], total

    def indexed_chunk_rows(self) -> list[sqlite3.Row]:
        return self.db.query(
            """SELECT c.vector_id, c.text FROM chunks c JOIN documents d ON d.id = c.document_id
               WHERE d.status = 'processed' ORDER BY c.vector_id"""
        )

    def total_chunks(self) -> int:
        return int(
            self.db.scalar(
                "SELECT COUNT(*) FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.status = 'processed'"
            )
        )
