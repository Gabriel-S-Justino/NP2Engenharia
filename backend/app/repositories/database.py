"""Acesso ao SQLite com migrações versionadas.

O SQLite guarda a fonte da verdade sobre documentos, trechos (chunks), histórico,
avaliações e diário da IA mentora. O índice vetorial guarda apenas vetores e os
IDs inteiros que apontam para a tabela `chunks`.
"""

from __future__ import annotations

import sqlite3
import threading
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

MIGRATIONS: list[str] = [
    # 1 — esquema inicial
    """
    CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL,
        origin TEXT NOT NULL,                -- documentos | upload | fixtures
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        status TEXT NOT NULL,                -- pending | processing | processed | failed | excluded
        error_message TEXT,
        page_count INTEGER,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        warnings_json TEXT NOT NULL DEFAULT '[]',
        embedding_fingerprint TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        file_modified_at TEXT,
        indexed_at TEXT,
        UNIQUE(origin, relative_path)
    );
    CREATE INDEX idx_documents_sha ON documents(sha256);
    CREATE TABLE chunks (
        vector_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        page INTEGER,
        section TEXT,
        text TEXT NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        content_sha TEXT NOT NULL,
        suspicious INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_chunks_document ON chunks(document_id);
    CREATE TABLE kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE ingestion_runs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        stats_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT
    );
    CREATE TABLE chat_interactions (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        status TEXT NOT NULL,
        evidence_status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        retrieval_ms REAL,
        generation_ms REAL,
        total_ms REAL,
        citations_count INTEGER NOT NULL DEFAULT 0,
        citations_valid INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );
    CREATE INDEX idx_chat_conversation ON chat_interactions(conversation_id, created_at);
    CREATE TABLE evaluation_runs (
        id TEXT PRIMARY KEY,
        suite TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        params_json TEXT NOT NULL DEFAULT '{}',
        summary_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT
    );
    CREATE TABLE evaluation_results (
        run_id TEXT NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
        case_id TEXT NOT NULL,
        category TEXT NOT NULL,
        passed INTEGER NOT NULL,
        result_json TEXT NOT NULL,
        adjustment TEXT,
        adjustment_at TEXT,
        PRIMARY KEY (run_id, case_id)
    );
    CREATE TABLE mentor_log (
        id TEXT PRIMARY KEY,
        entry_date TEXT NOT NULL,
        stage TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        evidence TEXT,
        decision TEXT NOT NULL,
        change_made TEXT,
        test_executed TEXT,
        result_before TEXT,
        result_after TEXT,
        author TEXT,
        created_at TEXT NOT NULL
    );
    """,
]


class Database:
    """Wrapper mínimo e thread-safe sobre sqlite3."""

    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.execute("PRAGMA busy_timeout = 5000")
        self.migrate()

    def migrate(self) -> None:
        with self._lock:
            current = self._conn.execute("PRAGMA user_version").fetchone()[0]
            for version, script in enumerate(MIGRATIONS, start=1):
                if version <= current:
                    continue
                self._conn.executescript(f"BEGIN; {script} PRAGMA user_version = {version}; COMMIT;")

    @property
    def schema_version(self) -> int:
        return int(self._conn.execute("PRAGMA user_version").fetchone()[0])

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            self._conn.execute("BEGIN")
            try:
                yield self._conn
            except BaseException:
                self._conn.execute("ROLLBACK")
                raise
            else:
                self._conn.execute("COMMIT")

    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._conn.execute(sql, tuple(params))

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, tuple(params)).fetchall()

    def query_one(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(sql, tuple(params)).fetchone()

    def scalar(self, sql: str, params: Iterable[Any] = ()) -> Any:
        row = self.query_one(sql, params)
        return None if row is None else row[0]

    # Chave-valor (metadados do índice, configurações sobrescritas em tempo de execução)
    def get_kv(self, key: str) -> str | None:
        value = self.scalar("SELECT value FROM kv WHERE key = ?", (key,))
        return None if value is None else str(value)

    def set_kv(self, key: str, value: str) -> None:
        self.execute(
            "INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )

    def close(self) -> None:
        with self._lock:
            self._conn.close()
