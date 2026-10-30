"""Acesso ao banco relacional com migrações versionadas.

Dois dialetos com a mesma interface:

* **SQLite** (padrão local): arquivo em `DATA_DIR/database/acervo.sqlite3`.
* **Postgres** (produção serverless, ex.: Neon na Vercel): ativado por `DATABASE_URL`. Guarda também os vetores
  (extensão pgvector) e os arquivos originais, pois funções serverless não têm disco persistente.

O banco é a fonte da verdade sobre documentos, trechos (chunks), histórico, avaliações e diário da IA mentora.
As consultas são escritas com `?` como marcador; o dialeto Postgres converte para `%s`.
"""

from __future__ import annotations

import sqlite3
import threading
from abc import ABC, abstractmethod
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

SQLITE_MIGRATIONS: list[str] = [
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
    # 2 — arquivos originais guardados no banco (uploads e, opcionalmente, todo o acervo)
    """
    CREATE TABLE document_files (
        document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        content BLOB NOT NULL,
        sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
    );
    """,
]

POSTGRES_MIGRATIONS: list[str] = [
    # 1 — esquema inicial completo (equivalente às migrações 1 e 2 do SQLite + vetores pgvector)
    """
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL,
        origin TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        sha256 TEXT NOT NULL,
        status TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_documents_sha ON documents(sha256);
    CREATE TABLE IF NOT EXISTS chunks (
        vector_id BIGSERIAL PRIMARY KEY,
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
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
    CREATE TABLE IF NOT EXISTS chunk_vectors (
        vector_id BIGINT PRIMARY KEY REFERENCES chunks(vector_id) ON DELETE CASCADE,
        embedding vector NOT NULL
    );
    CREATE TABLE IF NOT EXISTS document_files (
        document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        content BYTEA NOT NULL,
        sha256 TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        stats_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT
    );
    CREATE TABLE IF NOT EXISTS chat_interactions (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        status TEXT NOT NULL,
        evidence_status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        retrieval_ms DOUBLE PRECISION,
        generation_ms DOUBLE PRECISION,
        total_ms DOUBLE PRECISION,
        citations_count INTEGER NOT NULL DEFAULT 0,
        citations_valid INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_interactions(conversation_id, created_at);
    CREATE TABLE IF NOT EXISTS evaluation_runs (
        id TEXT PRIMARY KEY,
        suite TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        params_json TEXT NOT NULL DEFAULT '{}',
        summary_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT
    );
    CREATE TABLE IF NOT EXISTS evaluation_results (
        run_id TEXT NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
        case_id TEXT NOT NULL,
        category TEXT NOT NULL,
        passed INTEGER NOT NULL,
        result_json TEXT NOT NULL,
        adjustment TEXT,
        adjustment_at TEXT,
        PRIMARY KEY (run_id, case_id)
    );
    CREATE TABLE IF NOT EXISTS mentor_log (
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


def now_iso() -> str:
    """Instante atual em ISO 8601 (UTC, milissegundos): ordena corretamente como texto nos dois dialetos."""
    return datetime.now(UTC).isoformat(timespec="milliseconds")


class Database(ABC):
    """Interface comum aos dialetos. Métodos retornam linhas acessíveis por nome (`row["col"]`) e posição."""

    dialect: str

    def __init__(self) -> None:
        self._lock = threading.RLock()

    # Implementação por dialeto ---------------------------------------------------
    @abstractmethod
    def execute(self, sql: str, params: Iterable[Any] = ()) -> Any: ...

    @abstractmethod
    def query(self, sql: str, params: Iterable[Any] = ()) -> list[Any]: ...

    @abstractmethod
    def query_one(self, sql: str, params: Iterable[Any] = ()) -> Any | None: ...

    @abstractmethod
    @contextmanager
    def transaction(self) -> Iterator[Any]: ...

    @property
    @abstractmethod
    def schema_version(self) -> int: ...

    @abstractmethod
    def close(self) -> None: ...

    # Comuns -------------------------------------------------------------------------
    def scalar(self, sql: str, params: Iterable[Any] = ()) -> Any:
        row = self.query_one(sql, params)
        return None if row is None else row[0]

    def get_kv(self, key: str) -> str | None:
        value = self.scalar("SELECT value FROM kv WHERE key = ?", (key,))
        return None if value is None else str(value)

    def set_kv(self, key: str, value: str) -> None:
        self.execute(
            "INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )

    def delete_kv(self, key: str) -> None:
        self.execute("DELETE FROM kv WHERE key = ?", (key,))

    def try_acquire_lease(self, name: str, ttl_seconds: float) -> bool:
        """Trava compartilhada entre processos/instâncias (com expiração para não ficar presa após falhas)."""
        now = datetime.now(UTC)
        expires = (now + timedelta(seconds=ttl_seconds)).isoformat(timespec="milliseconds")
        cursor = self.execute(
            """INSERT INTO kv(key, value) VALUES(?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE kv.value < ?""",
            (f"lease:{name}", expires, now.isoformat(timespec="milliseconds")),
        )
        return cursor.rowcount == 1

    def lease_active(self, name: str) -> bool:
        value = self.get_kv(f"lease:{name}")
        return value is not None and value > now_iso()

    def release_lease(self, name: str) -> None:
        self.delete_kv(f"lease:{name}")


class SQLiteDatabase(Database):
    dialect = "sqlite"

    def __init__(self, path: Path):
        super().__init__()
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.execute("PRAGMA busy_timeout = 5000")
        self.migrate()

    def migrate(self) -> None:
        with self._lock:
            current = self._conn.execute("PRAGMA user_version").fetchone()[0]
            for version, script in enumerate(SQLITE_MIGRATIONS, start=1):
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

    def close(self) -> None:
        with self._lock:
            self._conn.close()


class Row(dict):
    """Linha do Postgres acessível por nome e por posição (compatível com `sqlite3.Row`)."""

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def _row_factory(cursor: Any):
    names = [d.name for d in cursor.description] if cursor.description else []

    def make(values: Any) -> Row:
        return Row(zip(names, values, strict=True))

    return make


class _PgTransaction:
    """Adaptador para usar a mesma sintaxe (`?`) dentro de transações."""

    def __init__(self, conn: Any):
        self._conn = conn

    def execute(self, sql: str, params: Iterable[Any] = ()) -> Any:
        return self._conn.execute(sql.replace("?", "%s"), tuple(params))


class PostgresDatabase(Database):
    dialect = "postgres"
    MIGRATION_LOCK_ID = 7_310_442  # chave do pg_advisory_lock que serializa migrações entre instâncias

    def __init__(self, url: str):
        super().__init__()
        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - depende da instalação
            raise RuntimeError("DATABASE_URL definido, mas o pacote 'psycopg' não está instalado.") from exc
        self._psycopg = psycopg
        self._url = url
        self._conn = None
        self._connect()
        self.migrate()

    def _connect(self) -> None:
        # prepare_threshold=None: compatível com poolers em modo transação (ex.: endpoint "pooled" do Neon).
        self._conn = self._psycopg.connect(
            self._url, autocommit=True, row_factory=_row_factory, prepare_threshold=None, connect_timeout=10
        )

    def _ensure(self) -> Any:
        if self._conn is None or self._conn.closed or self._conn.broken:
            self._connect()
        return self._conn

    def _run(self, fn):
        """Executa com uma nova tentativa caso a conexão tenha sido encerrada (ex.: banco em repouso)."""
        with self._lock:
            try:
                return fn(self._ensure())
            except self._psycopg.OperationalError:
                self._conn = None
                return fn(self._ensure())

    def migrate(self) -> None:
        def apply(conn: Any) -> None:
            with conn.transaction():
                conn.execute("SELECT pg_advisory_xact_lock(%s)", (self.MIGRATION_LOCK_ID,))
                conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)")
                current = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").fetchone()[0]
                for version, script in enumerate(POSTGRES_MIGRATIONS, start=1):
                    if version <= current:
                        continue
                    conn.execute(script)
                    conn.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (version,))

        self._run(apply)

    @property
    def schema_version(self) -> int:
        return int(self.scalar("SELECT COALESCE(MAX(version), 0) FROM schema_migrations"))

    @contextmanager
    def transaction(self) -> Iterator[_PgTransaction]:
        with self._lock:
            conn = self._ensure()
            with conn.transaction():
                yield _PgTransaction(conn)

    def execute(self, sql: str, params: Iterable[Any] = ()) -> Any:
        return self._run(lambda conn: conn.execute(sql.replace("?", "%s"), tuple(params)))

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[Row]:
        return self._run(lambda conn: conn.execute(sql.replace("?", "%s"), tuple(params)).fetchall())

    def query_one(self, sql: str, params: Iterable[Any] = ()) -> Row | None:
        return self._run(lambda conn: conn.execute(sql.replace("?", "%s"), tuple(params)).fetchone())

    def close(self) -> None:
        with self._lock:
            if self._conn is not None and not self._conn.closed:
                self._conn.close()


def open_database(*, sqlite_path: Path, database_url: str | None) -> Database:
    if database_url:
        return PostgresDatabase(database_url)
    return SQLiteDatabase(sqlite_path)
