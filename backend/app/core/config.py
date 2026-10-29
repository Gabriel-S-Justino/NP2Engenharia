"""Configuração central da aplicação.

Todas as opções vêm de variáveis de ambiente (ou de um arquivo `.env`). A validação
acontece na inicialização: valores incoerentes interrompem o processo com uma
mensagem clara, em vez de produzir comportamento silenciosamente incorreto.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Raiz do repositório: backend/app/core/config.py -> parents[3]
REPO_ROOT = Path(__file__).resolve().parents[3]

EmbeddingProviderName = Literal["fastembed", "hashing"]
LLMProviderName = Literal["demo", "anthropic"]
VectorStoreName = Literal["faiss", "numpy"]

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

    # Caminhos
    documents_dir: Path = REPO_ROOT / "Documentos"
    data_dir: Path = REPO_ROOT / "data"
    fixtures_dir: Path = REPO_ROOT / "tests" / "fixtures" / "documentos_sinteticos"
    evaluation_dir: Path = REPO_ROOT / "tests" / "acceptance"

    # Pipeline
    vector_store: VectorStoreName = "faiss"
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

    @field_validator("llm_api_key", "admin_token", mode="before")
    @classmethod
    def _empty_secret_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

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
        return self

    # Propriedades derivadas -------------------------------------------------
    @property
    def cors_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_path(self) -> Path:
        return self.data_dir / "database" / "acervo.sqlite3"

    @property
    def index_dir(self) -> Path:
        return self.data_dir / "indexes"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

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
            self.uploads_dir,
            self.evaluation_output_dir,
            self.data_dir / "metadata",
        ):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
