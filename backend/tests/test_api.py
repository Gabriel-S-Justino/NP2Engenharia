"""Testes dos endpoints REST (contrato, validação, segurança e erros)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import make_settings


def test_health_and_openapi(client):
    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert health["embeddings"]["semantic"] is False  # hashing nos testes
    assert any("NÃO é semântica" in issue for issue in health["issues"])
    assert health["llm"]["is_llm"] is False
    schema = client.get("/openapi.json").json()
    for path in ("/api/chat", "/api/documents/upload", "/api/evaluations/run", "/api/mentor-log", "/api/sources/{source_id}"):
        assert path in schema["paths"]


def test_stats_reflect_real_state(indexed_client):
    stats = indexed_client.get("/api/stats").json()
    assert stats["documents_total"] == 3 and stats["documents_processed"] == 3
    assert stats["chunks_indexed"] > 0 and stats["last_indexed_at"]
    assert stats["questions_total"] == 0 and stats["last_evaluation"] is None
    indexed_client.post("/api/chat", json={"question": "Qual é a velocidade máxima nas vias escolares?"})
    assert indexed_client.get("/api/stats").json()["questions_answered"] == 1


def test_documents_list_detail_chunks_and_sources(indexed_client):
    listing = indexed_client.get("/api/documents?page_size=2&sort=name").json()
    assert listing["total"] == 3 and len(listing["items"]) == 2
    doc = listing["items"][0]
    detail = indexed_client.get(f"/api/documents/{doc['id']}").json()
    assert detail["metadata"]["title"] and detail["metadata"]["license"]
    chunks = indexed_client.get(f"/api/documents/{doc['id']}/chunks").json()
    assert chunks["total"] == doc["chunk_count"]
    source = indexed_client.get(f"/api/sources/{chunks['items'][0]['id']}").json()
    assert source["document"]["id"] == doc["id"]
    assert indexed_client.get("/api/sources/inexistente").status_code == 404
    assert indexed_client.get("/api/documents?status=failed").json()["total"] == 0
    assert indexed_client.get("/api/documents?search=guia").json()["total"] == 1


def test_chat_contract_and_history(indexed_client):
    response = indexed_client.post("/api/chat", json={"question": "Qual distância manter ao ultrapassar um ciclista?"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "answered" and body["citations_valid"] is True
    citation = body["citations"][0]
    for key in ("label", "source_id", "document_id", "document_title", "page", "excerpt", "relevance"):
        assert key in citation
    assert body["retrieval"]["top_k"] == 5 and body["latency"]["total_ms"] >= 0
    history = indexed_client.get(f"/api/chat/history/{body['conversation_id']}").json()
    assert len(history["items"]) == 1
    cleared = indexed_client.delete(f"/api/chat/history/{body['conversation_id']}").json()
    assert cleared["removed"] == 1


def test_chat_validation_errors_are_uniform(indexed_client):
    for payload in ({"question": "   "}, {}, {"question": "ok", "extra": 1}, {"question": "x", "top_k": 99}):
        response = indexed_client.post("/api/chat", json=payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "entrada_invalida"
    long_question = indexed_client.post("/api/chat", json={"question": "a" * 1500})
    assert long_question.status_code == 422


def test_upload_txt_then_delete_removes_file(indexed_client, settings):
    files = {"file": ("../../nova regra.txt", "Regra sintética de teste: estacionar em fila dupla é proibido em Vila Exemplo.", "text/plain")}
    response = indexed_client.post("/api/documents/upload", files=files)
    assert response.status_code == 201, response.text
    doc = response.json()["document"]
    assert doc["filename"] == "nova regra.txt"  # nome saneado, sem diretórios
    stored = settings.uploads_dir / "nova regra.txt"
    assert stored.exists() and stored.parent == settings.uploads_dir
    # aguarda a indexação disparada em segundo plano
    indexed_client.app.state.container.pipeline.ingestion.join(timeout=10)
    assert indexed_client.get(f"/api/documents/{doc['id']}").json()["status"] == "processed"
    duplicate = indexed_client.post("/api/documents/upload", files={"file": ("copia.txt", files["file"][1], "text/plain")})
    assert duplicate.status_code == 409
    deleted = indexed_client.delete(f"/api/documents/{doc['id']}").json()
    assert deleted["original_file_deleted"] is True and deleted["removed_vectors"] > 0
    assert not stored.exists()
    assert indexed_client.get(f"/api/documents/{doc['id']}").status_code == 404


def test_upload_rejections(client):
    bad_ext = client.post("/api/documents/upload", files={"file": ("script.exe", b"MZ...", "application/octet-stream")})
    assert bad_ext.status_code == 415
    fake_pdf = client.post("/api/documents/upload", files={"file": ("falso.pdf", b"<html>nao sou pdf</html>", "application/pdf")})
    assert fake_pdf.status_code == 415 and fake_pdf.json()["error"]["code"] == "conteudo_invalido"
    binary_txt = client.post("/api/documents/upload", files={"file": ("bin.txt", b"\x00\x01\x02", "text/plain")})
    assert binary_txt.status_code == 415
    empty = client.post("/api/documents/upload", files={"file": ("vazio.txt", b"", "text/plain")})
    assert empty.status_code == 400


def test_upload_size_limit(tmp_path):
    settings = make_settings(tmp_path, max_upload_size_mb=1)
    with TestClient(create_app(settings)) as c:
        big = c.post("/api/documents/upload", files={"file": ("grande.txt", b"a" * (1024 * 1024 + 10), "text/plain")})
        assert big.status_code == 413


def test_delete_document_from_documentos_preserves_original(indexed_client, settings):
    doc = next(d for d in indexed_client.get("/api/documents").json()["items"] if d["origin"] == "documentos")
    original = settings.documents_dir / doc["relative_path"]
    before = original.read_bytes()
    result = indexed_client.delete(f"/api/documents/{doc['id']}").json()
    assert result["original_file_deleted"] is False
    assert original.read_bytes() == before
    assert indexed_client.get(f"/api/documents/{doc['id']}").json()["status"] == "excluded"
    # Uma nova varredura não reinclui o documento excluído...
    indexed_client.post("/api/ingestion/scan?wait=true")
    assert indexed_client.get(f"/api/documents/{doc['id']}").json()["status"] == "excluded"
    # ...mas a reindexação explícita dele o reinclui.
    indexed_client.post("/api/ingestion/reindex?wait=true", json={"document_ids": [doc["id"]]})
    assert indexed_client.get(f"/api/documents/{doc['id']}").json()["status"] == "processed"


def test_ingestion_status_and_full_reindex(indexed_client):
    status = indexed_client.get("/api/ingestion/status").json()
    assert status["running"] is False and status["index"]["consistent"] is True
    run = indexed_client.post("/api/ingestion/reindex?wait=true").json()
    assert run["status"] == "completed" and run["stats"]["updated"] == 3


def test_settings_view_and_validated_updates(indexed_client):
    view = indexed_client.get("/api/settings").json()
    assert view["chunk_size"] == 800 and view["chunk_overlap"] == 120 and view["top_k"] == 5
    assert "llm_api_key" not in view and "admin_token" not in str(view).lower().replace("admin_required", "")
    bad = indexed_client.patch("/api/settings", json={"chunk_size": 300, "chunk_overlap": 300, "confirm_reindex": True})
    assert bad.status_code == 422
    needs_confirm = indexed_client.patch("/api/settings", json={"chunk_size": 500})
    assert needs_confirm.status_code == 409
    ok = indexed_client.patch("/api/settings", json={"top_k": 3, "similarity_threshold": 0.2})
    assert ok.status_code == 200 and ok.json()["top_k"] == 3
    answer = indexed_client.post("/api/chat", json={"question": "Qual é a velocidade máxima nas vias escolares?"}).json()
    assert answer["retrieval"]["top_k"] == 3 and answer["retrieval"]["similarity_threshold"] == 0.2
    changed = indexed_client.patch("/api/settings", json={"chunk_size": 500, "chunk_overlap": 80, "confirm_reindex": True})
    assert changed.status_code == 200
    indexed_client.app.state.container.pipeline.ingestion.join(timeout=10)
    assert indexed_client.get("/api/settings").json()["requires_reindex"] is False


def test_evaluation_run_and_results(client):
    assert client.get("/api/evaluations/results").status_code == 404
    suites = client.get("/api/evaluations").json()["suites"]
    assert {"fixtures", "acervo_real"} <= {s["id"] for s in suites}
    fixtures = next(s for s in suites if s["id"] == "fixtures")
    categories = [c["category"] for c in fixtures["cases"]]
    assert len(categories) == 10
    assert categories.count("present") == 6 and categories.count("absent") == 2
    assert categories.count("out_of_scope") + categories.count("adversarial") == 2
    state = client.post("/api/evaluations/run?wait=true", json={"suite": "fixtures"}).json()
    assert state["status"] == "completed"
    results = client.get(f"/api/evaluations/results?run_id={state['run_id']}").json()
    summary = results["summary"]
    assert summary["executed"] == 10
    assert summary["pass_rate"] == round(summary["passed"] / summary["executed"] * 100, 1)
    assert summary["target"] == 80.0
    adj = client.post(f"/api/evaluations/results/{state['run_id']}/cases/A1/adjustment",
                      json={"adjustment": "Teste de registro de ajuste."})
    assert adj.status_code == 200
    again = client.get(f"/api/evaluations/results?run_id={state['run_id']}").json()
    assert next(r for r in again["results"] if r["case_id"] == "A1")["adjustment"] == "Teste de registro de ajuste."
    # O acervo principal não foi contaminado pelas fixtures da avaliação.
    assert client.get("/api/stats").json()["documents_total"] == 0
    not_ready = client.post("/api/evaluations/run", json={"suite": "acervo_real"})
    assert not_ready.status_code == 409


def test_mentor_log_roundtrip(client):
    assert client.get("/api/mentor-log").json()["total"] == 0
    entry = {
        "entry_date": "2026-10-29", "stage": "Chunking", "prompt": "Avalie o tamanho dos chunks.",
        "response": "Resposta registrada pela equipe.", "decision": "Manter 800 caracteres.",
    }
    created = client.post("/api/mentor-log", json=entry)
    assert created.status_code == 201
    assert client.get("/api/mentor-log").json()["items"][0]["stage"] == "Chunking"
    assert client.post("/api/mentor-log", json={**entry, "entry_date": "29/10/2026"}).status_code == 422


def test_admin_token_protects_mutations(tmp_path):
    settings = make_settings(tmp_path, admin_token="token-de-teste-123")
    with TestClient(create_app(settings)) as c:
        assert c.post("/api/ingestion/scan").status_code == 403
        assert c.post("/api/ingestion/scan", headers={"X-Admin-Token": "errado"}).status_code == 403
        ok = c.post("/api/ingestion/scan?wait=true", headers={"X-Admin-Token": "token-de-teste-123"})
        assert ok.status_code == 202
        assert c.get("/api/documents").status_code == 200  # leitura continua pública
        assert c.post("/api/chat", json={"question": "Qual a velocidade nas vias escolares?"}).status_code == 200


def test_production_without_admin_token_blocks_mutations(tmp_path):
    settings = make_settings(tmp_path, app_env="production", cors_origins="https://acervo.example.app")
    with TestClient(create_app(settings)) as c:
        response = c.post("/api/ingestion/scan")
        assert response.status_code == 403 and response.json()["error"]["code"] == "admin_desabilitado"


def test_cors_restricted(client):
    allowed = client.options("/api/health", headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "GET"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:8081"
    denied = client.options("/api/health", headers={"Origin": "https://malicioso.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in denied.headers


def test_rate_limit(tmp_path):
    settings = make_settings(tmp_path, rate_limit_per_minute=2)
    with TestClient(create_app(settings)) as c:
        codes = [c.post("/api/chat", json={"question": "Teste de limite"}).status_code for _ in range(3)]
        assert codes == [200, 200, 429]


def test_errors_do_not_leak_internals(client):
    response = client.get("/api/documents/../../etc/passwd")
    assert response.status_code in (404, 403)
    body = response.text
    assert "Traceback" not in body and "/home/" not in body
    big = client.post("/api/chat", content=b"x", headers={"content-length": str(500 * 1024 * 1024), "content-type": "application/json"})
    assert big.status_code == 413
