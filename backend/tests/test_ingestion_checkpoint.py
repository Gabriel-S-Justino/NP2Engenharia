"""Regressões de OOM/interrupção: lotes limitados e retomada sem duplicação."""

import json

from app.core.container import Container
from app.services.embeddings import FastEmbedProvider
from tests.conftest import make_settings


def corpus(tmp_path):
    settings = make_settings(tmp_path, embedding_batch_size=2)
    for path in settings.documents_dir.iterdir():
        path.unlink()
    (settings.documents_dir / "regras.txt").write_text(
        "\n\n".join(f"Regra {i}: condutores devem manter distância e observar a sinalização. " * 8 for i in range(20)),
        encoding="utf-8",
    )
    return settings


def test_resume_after_new_process_preserves_committed_vectors(tmp_path, monkeypatch):
    settings = corpus(tmp_path)
    first = Container(settings)
    first.startup()
    run = first.pipeline.ingestion.start("scan", wait=True, time_budget=0.000001)
    assert run.status == "completed" and run.stats.remaining == 1
    doc = first.pipeline.documents.all_rows()[0]
    assert doc["status"] == "pending" and doc["chunk_count"] == 2
    before = first.pipeline.vector_store.ids()
    assert len(before) == 2
    assert first.pipeline.answer("Qual é a regra?", persist=False).status == "no_documents"
    first.shutdown()

    second = Container(settings)
    second.startup()
    assert before <= second.pipeline.vector_store.ids()  # reparo do índice não descarta lotes parciais
    calls = []
    embed = second.pipeline.embedder.embed_documents

    def record(texts):
        calls.append(len(texts))
        return embed(texts)

    monkeypatch.setattr(second.pipeline.embedder, "embed_documents", record)
    # Retomada não reabre o PDF/TXT: usa os trechos persistidos.
    monkeypatch.setattr(second.pipeline.ingestion, "_read_content", lambda *args: (_ for _ in ()).throw(AssertionError("releitura")))
    final = second.pipeline.ingestion.start("scan", wait=True)
    assert final.status == "completed" and final.stats.remaining == 0
    doc = second.pipeline.documents.all_rows()[0]
    assert doc["status"] == "processed"
    assert max(calls) <= 2
    assert final.stats.chunks_indexed == doc["chunk_count"] - 2
    assert second.pipeline.vector_store.count() == doc["chunk_count"]
    assert second.pipeline.ingestion.start("scan", wait=True).stats.unchanged == 1
    second.shutdown()


def test_expired_processing_state_becomes_pending_and_can_resume(tmp_path):
    settings = corpus(tmp_path)
    c = Container(settings)
    c.startup()
    c.pipeline.ingestion.start("scan", wait=True, time_budget=0.000001)
    doc = c.pipeline.documents.all_rows()[0]
    stale = "2000-01-01T00:00:00.000+00:00"
    c.pipeline.db.execute("UPDATE documents SET status = 'processing', updated_at = ? WHERE id = ?", (stale, doc["id"]))
    run = c.pipeline.ingestion_runs.start("scan")
    c.pipeline.db.execute("UPDATE ingestion_runs SET started_at = ? WHERE id = ?", (stale, run.id))
    assert not c.pipeline.ingestion.running
    assert c.pipeline.documents.get(doc["id"]).status == "pending"
    assert c.pipeline.db.scalar("SELECT status FROM ingestion_runs WHERE id = ?", (run.id,)) == "failed"
    assert c.pipeline.ingestion.start("scan", wait=True).stats.remaining == 0
    c.shutdown()


def test_active_lease_prevents_recovering_another_workers_document(tmp_path):
    settings = corpus(tmp_path)
    c = Container(settings)
    c.startup()
    c.pipeline.ingestion.start("scan", wait=True, time_budget=0.000001)
    doc = c.pipeline.documents.all_rows()[0]
    c.pipeline.db.execute("UPDATE documents SET status = 'processing', updated_at = ? WHERE id = ?",
                          ("2000-01-01T00:00:00.000+00:00", doc["id"]))
    assert c.pipeline.db.try_acquire_lease("ingestion", 60)
    assert c.pipeline.ingestion.running
    assert c.pipeline.documents.get(doc["id"]).status == "processing"
    c.pipeline.db.release_lease("ingestion")
    c.shutdown()


def test_changed_chunk_parameters_invalidate_checkpoint(tmp_path):
    settings = corpus(tmp_path)
    c = Container(settings)
    c.startup()
    c.pipeline.ingestion.start("scan", wait=True, time_budget=0.000001)
    doc = c.pipeline.documents.all_rows()[0]
    previous = json.loads(c.pipeline.db.get_kv(f"ingestion_checkpoint:{doc['id']}"))["signature"]
    c.pipeline.set_overrides({"chunk_size": 500})
    c.pipeline.ingestion.start("scan", wait=True, time_budget=0.000001)
    current = json.loads(c.pipeline.db.get_kv(f"ingestion_checkpoint:{doc['id']}"))["signature"]
    assert current != previous
    assert c.pipeline.vector_store.count() == 2
    c.shutdown()


def test_fastembed_sets_small_inference_batches_without_loading_a_model():
    calls = []

    class Engine:
        def embed(self, texts, **kwargs):
            import numpy as np
            calls.append(kwargs)
            yield from (np.ones(3) for _ in texts)

    provider = FastEmbedProvider.__new__(FastEmbedProvider)
    provider._engine = Engine()
    provider._e5 = False
    provider.batch_size = 2
    provider.dim = 3
    assert provider.embed_documents(["um", "dois", "três"]).shape == (3, 3)
    assert calls == [{"batch_size": 2}]
