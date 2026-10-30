"""Integração com Postgres + pgvector (configuração de produção na Vercel/Neon).

Executados somente quando TEST_DATABASE_URL aponta para um banco de TESTE descartável (o esquema `public`
é recriado a cada teste). Exemplo local:
    TEST_DATABASE_URL=postgresql://acervo:acervo@127.0.0.1:5432/acervo_test pytest tests/test_postgres.py
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.container import Container
from app.core.errors import ConflictError
from app.main import create_app
from tests.conftest import make_settings

DB_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB_URL, reason="TEST_DATABASE_URL não definido (requer Postgres com pgvector)")


@pytest.fixture(autouse=True)
def clean_database():
    import psycopg

    with psycopg.connect(DB_URL, autocommit=True) as conn:
        conn.execute("DROP SCHEMA IF EXISTS public CASCADE")
        conn.execute("CREATE SCHEMA public")
    yield


def pg_settings(tmp_path, **overrides):
    return make_settings(tmp_path, database_url=DB_URL, **overrides)


def scan(c: Container, kind: str = "scan", **kwargs):
    return c.pipeline.ingestion.start(kind, wait=True, **kwargs)


def test_postgres_pgvector_ingest_answer_and_persist(tmp_path):
    settings = pg_settings(tmp_path)
    assert settings.vector_store == "pgvector" and settings.store_originals_in_db
    c1 = Container(settings)
    c1.startup()
    assert c1.pipeline.db.dialect == "postgres"
    run = scan(c1)
    assert run.status == "completed" and run.stats.new == 3
    p = c1.pipeline
    assert p.vector_store.backend == "pgvector"
    assert p.vector_store.count() == p.documents.total_chunks() > 0
    answer = p.answer("Qual é a velocidade máxima permitida nas vias escolares de Vila Exemplo?", persist=True)
    assert answer.status == "answered" and "25 km/h" in answer.answer and answer.citations_valid
    refused = p.answer("Qual é o valor da multa por usar celular ao dirigir?", persist=False)
    assert refused.status in ("insufficient_evidence", "out_of_scope")
    conversation = answer.conversation_id
    c1.shutdown()

    # Nova instância (como um novo deploy/cold start): nada foi perdido.
    c2 = Container(settings)
    c2.startup()
    assert c2.pipeline.vector_store.count() == c2.pipeline.documents.total_chunks()
    assert len(c2.pipeline.chat.history(conversation)) == 1
    assert scan(c2).stats.unchanged == 3  # idempotente
    c2.shutdown()


def test_serverless_mode_without_local_files_keeps_documents(tmp_path):
    """Acervo ingerido por uma máquina (CLI) e servido pela Vercel, onde a pasta Documentos/ está vazia."""
    c1 = Container(pg_settings(tmp_path))
    c1.startup()
    scan(c1)
    c1.shutdown()

    empty = tmp_path / "vazio"
    empty.mkdir()
    settings = pg_settings(tmp_path, serverless=True, documents_dir=empty, data_dir=tmp_path / "tmp-vercel")
    assert settings.prune_missing_files is False and settings.max_upload_size_mb == 4
    c2 = Container(settings)
    c2.startup()
    assert c2.pipeline._embedder is None  # carregamento sob demanda
    run = scan(c2)
    assert run.status == "completed" and run.stats.removed == 0 and run.stats.unchanged == 3
    assert c2.pipeline.answer("Até que idade o assento de elevação é obrigatório?", persist=False).status == "answered"
    # Reindexação a partir dos originais guardados no banco (sem arquivos locais).
    run = scan(c2, "reindex", force=True)
    assert run.stats.updated == 3 and run.stats.remaining == 0
    assert c2.pipeline.vector_store.count() == c2.pipeline.documents.total_chunks()
    c2.shutdown()


def test_time_budget_leaves_pending_queue_and_continues(tmp_path):
    settings = pg_settings(tmp_path, serverless=True, ingestion_time_budget_seconds=5)
    c = Container(settings)
    c.startup()
    # Orçamento mínimo: força parar após o primeiro documento.
    first = c.pipeline.ingestion.start("scan", time_budget=0.0001)
    assert first.status == "completed" and first.stats.processed_so_far == 1 and first.stats.remaining == 2
    second = c.pipeline.ingestion.start("scan")
    assert second.stats.remaining == 0 and second.stats.new == 2
    assert c.pipeline.documents.counts().get("processed") == 3
    c.shutdown()


def test_lease_blocks_concurrent_ingestion_between_instances(tmp_path):
    settings = pg_settings(tmp_path)
    c1, c2 = Container(settings), Container(settings)
    c1.startup()
    c2.startup()
    assert c1.pipeline.db.try_acquire_lease("ingestion", 60)  # outra instância indexando
    with pytest.raises(ConflictError):
        scan(c2)
    assert c2.pipeline.ingestion.running
    c1.pipeline.db.release_lease("ingestion")
    assert scan(c2).status == "completed"
    c1.shutdown()
    c2.shutdown()


def test_missing_vectors_are_repaired_incrementally(tmp_path):
    settings = pg_settings(tmp_path)
    c1 = Container(settings)
    c1.startup()
    scan(c1)
    total = c1.pipeline.vector_store.count()
    c1.pipeline.db.execute("DELETE FROM chunk_vectors WHERE vector_id IN (SELECT vector_id FROM chunk_vectors LIMIT 2)")
    c1.shutdown()
    c2 = Container(settings)
    c2.startup()
    assert c2.pipeline.vector_store.count() == total
    c2.shutdown()


def test_serverless_api_upload_evaluation_and_ephemeral_guard(tmp_path):
    settings = pg_settings(tmp_path, serverless=True, admin_token="token-teste-123", data_dir=tmp_path / "tmp-vercel")
    headers = {"X-Admin-Token": "token-teste-123"}
    with TestClient(create_app(settings)) as client:
        health = client.get("/api/health").json()
        assert health["storage"] == {"backend": "postgres", "persistent": True, "serverless": True,
                                     "originals_in_database": True}
        assert health["embeddings"]["loaded"] is False
        files = {"file": ("regra.txt", "Regra sintética: proibido estacionar sobre a ciclovia azul de Vila Exemplo.", "text/plain")}
        uploaded = client.post("/api/documents/upload", files=files, headers=headers)
        assert uploaded.status_code == 201, uploaded.text
        assert uploaded.json()["document"]["status"] == "processed"  # síncrono em serverless
        scan_run = client.post("/api/ingestion/scan", headers=headers).json()
        assert scan_run["status"] == "completed" and scan_run["stats"]["remaining"] == 0
        state = client.post("/api/evaluations/run", json={"suite": "fixtures"}, headers=headers).json()
        assert state["status"] == "completed"
        results = client.get(f"/api/evaluations/results?run_id={state['run_id']}").json()
        assert results["summary"]["executed"] == 10
        # O acervo principal (Postgres) não recebeu as fixtures da avaliação.
        names = {d["filename"] for d in client.get("/api/documents").json()["items"]}
        assert names == {"regra.txt", "boletim_sintetico_mobilidade_com_injecao.txt",
                         "guia_sintetico_pedestres_ciclistas.txt", "regulamento_sintetico_vila_exemplo.pdf"}
        assert client.get("/api/cron/ingestion").status_code == 403

    ephemeral = make_settings(tmp_path / "e", serverless=True, admin_token="t" * 12, data_dir=tmp_path / "e-data")
    with TestClient(create_app(ephemeral)) as client:
        health = client.get("/api/health").json()
        assert health["status"] == "degraded" and not health["storage"]["persistent"]
        blocked = client.post("/api/ingestion/scan", headers={"X-Admin-Token": "t" * 12})
        assert blocked.status_code == 503 and blocked.json()["error"]["code"] == "armazenamento_efemero"


def test_cron_endpoint_requires_secret(tmp_path):
    settings = pg_settings(tmp_path, serverless=True, cron_secret="segredo-cron-123", data_dir=tmp_path / "tmp-vercel")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/cron/ingestion", headers={"Authorization": "Bearer errado"}).status_code == 403
        ok = client.get("/api/cron/ingestion", headers={"Authorization": "Bearer segredo-cron-123"})
        assert ok.status_code == 200 and ok.json()["stats"]["new"] == 3
