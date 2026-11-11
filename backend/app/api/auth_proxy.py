"""Encaminha as operações de conta da web ao Neon Auth."""
from __future__ import annotations

import logging
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter(prefix="/api/auth")
logger = logging.getLogger("acervo.auth")
ACTIONS = {
    "get-session": "GET",
    "sign-in/email": "POST",
    "sign-up/email": "POST",
    "sign-out": "POST",
    "email-otp/request-password-reset": "POST",
    "email-otp/reset-password": "POST",
}
COOKIE_PREFIXES = ("__Secure-neon-auth.", "neon-auth.")


def error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"code": code}, status_code=status, headers={"Cache-Control": "no-store, private"})


def session_cookies(header: str) -> str:
    return "; ".join(part.strip() for part in header.split(";") if part.strip().startswith(COOKIE_PREFIXES))


def first_party_cookie(value: str) -> str | None:
    parts = [part.strip() for part in value.split(";")]
    if not parts[0].startswith(COOKIE_PREFIXES):
        return None
    excluded = {"domain", "partitioned", "samesite", "path", "httponly", "secure"}
    attributes = [part for part in parts[1:] if part.split("=", 1)[0].lower() not in excluded]
    return "; ".join([parts[0], *attributes, "Path=/api/auth", "Secure", "HttpOnly", "SameSite=Lax"])


@router.api_route("/{action:path}", methods=["GET", "POST"], include_in_schema=False)
async def proxy_auth(action: str, request: Request) -> Response:
    if ACTIONS.get(action) != request.method:
        return error(404, "AUTH_ROUTE_NOT_FOUND")
    settings = request.app.state.settings
    origin = request.headers.get("origin")
    scheme = "https" if settings.app_env == "production" else request.url.scheme
    expected_origin = f"{scheme}://{request.url.netloc}"
    if (
        request.headers.get("sec-fetch-site") not in (None, "same-origin", "none")
        or (request.method == "POST" and origin != expected_origin)
        or (origin is not None and origin != expected_origin)
    ):
        return error(403, "INVALID_ORIGIN")
    base_url = settings.neon_auth_base_url
    if not base_url or urlsplit(base_url).scheme != "https":
        return error(503, "AUTH_NOT_CONFIGURED")
    body = await request.body()
    if len(body) > 8192:
        return error(413, "AUTH_BODY_TOO_LARGE")
    content_type = request.headers.get("content-type", "").split(";", 1)[0]
    if body and content_type != "application/json":
        return error(415, "VALIDATION_ERROR")
    headers = {"Origin": expected_origin, "Accept": "application/json"}
    if body:
        headers["Content-Type"] = "application/json"
    cookies = session_cookies(request.headers.get("cookie", ""))
    if cookies:
        headers["Cookie"] = cookies
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
            upstream = await client.request(
                request.method, f"{base_url.rstrip('/')}/{action}", headers=headers, content=body
            )
    except httpx.TimeoutException:
        logger.warning("auth_upstream_timeout", extra={"action": action})
        return error(504, "AUTH_TIMEOUT")
    except httpx.RequestError:
        logger.warning("auth_upstream_connection", extra={"action": action})
        return error(502, "AUTH_UNAVAILABLE")
    if upstream.status_code >= 400:
        logger.info("auth_upstream_error", extra={"action": action, "status": upstream.status_code})
    if upstream.is_redirect or (
        upstream.content and "application/json" not in upstream.headers.get("content-type", "")
    ):
        return error(502, "AUTH_UNAVAILABLE")
    response = Response(upstream.content, status_code=upstream.status_code, media_type="application/json",
                        headers={"Cache-Control": "no-store, private"})
    for name in ("set-auth-jwt", "retry-after"):
        if name in upstream.headers:
            response.headers[name] = upstream.headers[name]
    for cookie in upstream.headers.get_list("set-cookie"):
        local_cookie = first_party_cookie(cookie)
        if local_cookie:
            response.headers.append("Set-Cookie", local_cookie)
    return response
