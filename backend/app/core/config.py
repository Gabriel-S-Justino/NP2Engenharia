"""Configuração central da aplicação.

Todas as opções vêm de variáveis de ambiente (ou de um arquivo `.env`). A validação
acontece na inicialização: valores incoerentes interrompem o processo com uma
mensagem clara, em vez de produzir comportamento silenciosamente incorreto.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Raiz do repositório: backend/app/core/config.py -> parents[3]
REPO_ROOT = Path(__file__).resolve().parents[3]

EmbeddingProviderName = Literal["fastembed", "hashing"]
LLMProviderName = Literal["demo", "anthropic"]
VectorStoreName = Literal["faiss", "numpy", "pgvector"]

# Limiares iniciais por provedor de embeddings (similaridade de cosseno).
# hashing: calibrado em docs/resultados/calibracao_hashing_fixtures.md (sugestão 0,141 → 0,15).
# fastembed: valor inicial NÃO calibrado; recalibre com os documentos reais da equipe.
DEFAULT_THRESHOLDS = {"hashing": 0.15, "fastembed": 0.35}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(REPO_ROOT / "backend" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Aplicação
    app_env: Literal["development", "test", "production"] = "development"
    api_host: str = "127.0.0.1"
    api_port: int = Field(default=8000, ge=1, le=65535)
    cors_origins: str = "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006"
    log_level: str = "INFO"

    # Ambiente serverless (Vercel define VERCEL=1). None = detectar automaticamente.
    serverless: bool | None = None
    # Postgres (Neon via Vercel Marketplace define DATABASE_URL). Sem ele, usa SQLite local.
    database_url: SecretStr | None = Field(default=None, validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_URL"))
    # Guarda o arquivo original no banco (necessário para reindexar onde não há disco persistente).
    store_originals_in_db: bool | None = None
    # Remove do índice documentos cujo arquivo sumiu da pasta (desligado em serverless, onde a pasta é a do deploy).
    prune_missing_files: bool | None = None
    # Tempo máximo de uma execução de ingestão; o restante fica pendente para a próxima chamada.
    ingestion_time_budget_seconds: float = Field(default=240.0, ge=5, le=3600)
    allow_ephemeral_storage: bool = False
    cron_secret: SecretStr | None = None

    # Caminhos
    documents_dir: Path = REPO_ROOT / "Documentos"
    data_dir: Path = REPO_ROOT / "data"
    fixtures_dir: Path = REPO_ROOT / "tests" / "fixtures" / "documentos_sinteticos"
    evaluation_dir: Path = REPO_ROOT / "tests" / "acceptance"

    # Pipeline
    vector_store: VectorStoreName | None = None  # None = pgvector com Postgres, senão faiss
    embedding_provider: EmbeddingProviderName = "fastembed"
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_cache_dir: Path | None = None
    hashing_dim: int = Field(default=2048, ge=128, le=16384)

    llm_provider: LLMProviderName = "demo"
    llm_model: str = "claude-opus-5-5"
    llm_api_key: SecretStr | None = None
    llm_timeout_seconds: float = Field(default=60.0, gt=0, le=600)
    llm_max_output_tokens: int = Field(default=2048, ge=128, le=16000)
    llm_effort: Literal["low", "medium", "high"] = "low"

    chunk_size: int = Field(default=800, ge=200, le=4000)
    chunk_overlap: int = Field(default=120, ge=0, le=1000)
    min_chunk_chars: int = Field(default=60, ge=10, le=500)
    top_k: int = Field(default=5, ge=1, le=20)
    # None = valor padrão calibrado por provedor (ver DEFAULT_THRESHOLDS e scripts/calibrate_threshold.py)
    similarity_threshold: float | None = Field(default=None, ge=-1.0, le=1.0)
    weak_evidence_margin: float = Field(default=0.08, ge=0.0, le=1.0)
    min_term_coverage: float = Field(default=0.5, ge=0.0, le=1.0)

    # Limites e segurança
    max_upload_size_mb: int = Field(default=20, ge=1, le=200)
    max_question_chars: int = Field(default=1000, ge=10, le=10000)
    max_request_body_mb: int = Field(default=25, ge=1, le=250)
    admin_token: SecretStr | None = None
    rate_limit_per_minute: int = Field(default=30, ge=0, le=10000)
    auto_ingest_on_startup: bool = False
    ocr_enabled: bool = False
    history_retention_days: int = Field(default=30, ge=0, le=3650)

    @field_validator("documents_dir", "data_dir", "fixtures_dir", "evaluation_dir", mode="before")
    @classmethod
    def _resolve_path(cls, value: object) -> object:
        if isinstance(value, str) and value and not Path(value).is_absolute():
            return (REPO_ROOT / value).resolve()
        return value

    @field_validator("llm_api_key", "admin_token", "database_url", "cron_secret", mode="before")
    @classmethod
    def _empty_secret_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def _resolve_environment(self) -> Settings:
        """Valores padrão que dependem do ambiente (local x Vercel). Valores explícitos sempre prevalecem."""
        explicit = self.model_fields_set
        if self.serverless is None:
            self.serverless = os.environ.get("VERCEL") == "1"
        if self.serverless:
            if "app_env" not in explicit:
                self.app_env = "production"
            if "data_dir" not in explicit:
                self.data_dir = Path("/tmp/acervo-data")  # único diretório gravável; usado só como rascunho
            if self.embedding_cache_dir is None:
                self.embedding_cache_dir = Path("/tmp/fastembed-cache")
            if "max_upload_size_mb" not in explicit:
                self.max_upload_size_mb = 4  # corpo de requisição da Vercel é limitado a 4,5 MB
            self.auto_ingest_on_startup = False
            os.environ.setdefault("HF_HOME", "/tmp/hf-home")
        if self.vector_store is None:
            self.vector_store = "pgvector" if self.database_url else "faiss"
        if self.store_originals_in_db is None:
            self.store_originals_in_db = self.database_url is not None
        if self.prune_missing_files is None:
            self.prune_missing_files = not self.serverless
        return self

    @model_validator(mode="after")
    def _check_coherence(self) -> Settings:
        if self.similarity_threshold is None:
            self.similarity_threshold = DEFAULT_THRESHOLDS[self.embedding_provider]
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                f"CHUNK_OVERLAP ({self.chunk_overlap}) deve ser menor que CHUNK_SIZE ({self.chunk_size})."
            )
        if self.min_chunk_chars >= self.chunk_size:
            raise ValueError("MIN_CHUNK_CHARS deve ser menor que CHUNK_SIZE.")
        if self.llm_provider == "anthropic" and self.llm_api_key is None:
            raise ValueError(
                "LLM_PROVIDER=anthropic exige LLM_API_KEY configurada no servidor. "
                "Use LLM_PROVIDER=demo para o modo de demonstração sem credenciais."
            )
        if self.app_env == "production" and "*" in self.cors_list:
            raise ValueError("CORS_ORIGINS não pode conter '*' em produção.")
        if self.vector_store == "pgvector" and self.database_url is None:
            raise ValueError("VECTOR_STORE=pgvector exige DATABASE_URL (Postgres com a extensão pgvector).")
        if self.database_url is not None and self.vector_store != "pgvector":
            raise ValueError(
                "Com DATABASE_URL (Postgres), use VECTOR_STORE=pgvector: o índice precisa ficar no mesmo banco persistente."
            )
        return self

    # Propriedades derivadas -------------------------------------------------
    @property
    def cors_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def uses_postgres(self) -> bool:
        return self.database_url is not None

    @property
    def persistent_storage(self) -> bool:
        """Dados sobrevivem a reinícios/novos deploys? Em serverless, só com Postgres."""
        return self.uses_postgres or not self.serverless

    @property
    def database_path(self) -> Path:
        return self.data_dir / "database" / "acervo.sqlite3"

    @property
    def index_dir(self) -> Path:
        return self.data_dir / "indexes"

    @property
    def evaluation_output_dir(self) -> Path:
        return self.data_dir / "evaluations"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def admin_required(self) -> bool:
        """Operações administrativas exigem token quando configurado ou em produção."""
        return self.admin_token is not None or self.app_env == "production"

    def ensure_directories(self) -> None:
        for path in (
            self.data_dir,
            self.database_path.parent,
            self.index_dir,
            self.evaluation_output_dir,
            self.data_dir / "metadata",
        ):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
