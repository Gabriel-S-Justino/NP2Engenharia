from types import SimpleNamespace

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import auth_proxy

ORIGIN = "https://lumme.example"
PROVIDER = "https://neon.example/neondb/auth"


def make_client():
    app = FastAPI()
    app.state.settings = SimpleNamespace(app_env="production", neon_auth_base_url=PROVIDER)
    app.include_router(auth_proxy.router)
    return TestClient(app, base_url=ORIGIN)


def test_proxy_blocks_cross_origin_posts_and_unknown_routes():
    client = make_client()
    path = "/api/auth/sign-in/email"
    assert client.post(path, json={}).status_code == 403
    assert client.post(path, json={}, headers={"Origin": "https://elsewhere.example"}).status_code == 403
    assert client.post("/api/auth/admin/list-users", headers={"Origin": ORIGIN}).status_code == 404


def test_proxy_preserves_provider_error_and_rewrites_session_cookie(monkeypatch):
    def handler(request):
        assert str(request.url) == PROVIDER + "/sign-in/email"
        assert request.headers["Origin"] == ORIGIN
        assert request.headers["Cookie"] == "__Secure-neon-auth.session_token=old"
        assert "Authorization" not in request.headers
        return httpx.Response(401, json={"code": "INVALID_EMAIL_OR_PASSWORD"}, headers=[
            ("Set-Cookie", "__Secure-neon-auth.session_token=; Domain=neon.example; Path=/; Max-Age=0; Secure; SameSite=None; Partitioned"),
            ("Set-Cookie", "unrelated=ignored"),
            ("Set-Auth-Jwt", "jwt"),
        ])

    real_client = httpx.AsyncClient
    monkeypatch.setattr(auth_proxy.httpx, "AsyncClient", lambda **kwargs: real_client(
        transport=httpx.MockTransport(handler), **kwargs
    ))
    response = make_client().post("/api/auth/sign-in/email", json={}, headers={
        "Origin": ORIGIN, "Cookie": "unrelated=ignored; __Secure-neon-auth.session_token=old",
        "Authorization": "Bearer ignored",
    })
    assert response.status_code == 401
    assert response.json() == {"code": "INVALID_EMAIL_OR_PASSWORD"}
    assert response.headers["set-auth-jwt"] == "jwt"
    assert response.headers["cache-control"] == "no-store, private"
    assert response.headers.get_list("set-cookie") == [
        "__Secure-neon-auth.session_token=; Max-Age=0; Path=/api/auth; Secure; HttpOnly; SameSite=Lax"
    ]
