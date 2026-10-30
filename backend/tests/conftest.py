"""Fixtures de teste.

Todos os testes usam embeddings `hashing` (determinísticos, offline) e o gerador `demo`.
Testes que exigiriam um LLM real são identificados e usam dublês (fakes) explícitos.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import REPO_ROOT, Settings
from app.main import create_app

FIXTURES = REPO_ROOT / "tests" / "fixtures" / "documentos_sinteticos"


def make_settings(tmp_path: Path, **overrides) -> Settings:
    docs = tmp_path / "Documentos"
    if not docs.exists():
        shutil.copytree(FIXTURES, docs)
    values = dict(
        app_env="test",
        documents_dir=docs,
        data_dir=tmp_path / "data",
        fixtures_dir=FIXTURES,
        embedding_provider="hashing",
        llm_provider="demo",
        vector_store="faiss",
        rate_limit_per_minute=0,
        log_level="WARNING",
        cors_origins="http://localhost:8081",
        admin_token=None,
    )
    if overrides.get("database_url"):
        values.pop("vector_store")  # com Postgres o padrão é pgvector
        overrides = {**overrides, "DATABASE_URL": overrides.pop("database_url")}
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def indexed_client(client: TestClient) -> TestClient:
    response = client.post("/api/ingestion/scan?wait=true")
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "completed"
    return client
