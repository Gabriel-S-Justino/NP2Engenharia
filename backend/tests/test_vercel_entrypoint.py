"""Entrypoint da Vercel (api/index.py): detecção como ASGI e roteamento das reescritas de /api/*."""

from __future__ import annotations

import importlib.util
import inspect

from fastapi.testclient import TestClient

from app.core.config import REPO_ROOT
from app.core.vercel import RestoreRewrittenPath
from app.main import create_app
from tests.conftest import make_settings


def test_entrypoint_exports_asgi_app_detectable_by_vercel(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "hashing")
    spec = importlib.util.spec_from_file_location("vercel_index_test", REPO_ROOT / "api" / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    app = module.app
    # Mesma regra do runtime Python da Vercel: assíncrono com 3 parâmetros posicionais = ASGI.
    assert inspect.iscoroutinefunction(app.__call__)
    assert len(inspect.signature(app).parameters) == 3


def test_rewritten_and_original_paths_reach_the_same_route(tmp_path):
    app = RestoreRewrittenPath(create_app(make_settings(tmp_path)))
    with TestClient(app) as client:
        original = client.get("/api/health")
        rewritten = client.get("/api/index?path=health")
        assert original.status_code == rewritten.status_code == 200
        assert rewritten.json()["status"] == original.json()["status"]
        listing = client.get("/api/index?path=documents&page_size=1")
        assert listing.status_code == 200 and listing.json()["page_size"] == 1
        nested = client.get("/api/index?path=evaluations/results")
        assert nested.status_code == 404 and nested.json()["error"]["code"] == "sem_avaliacao"
