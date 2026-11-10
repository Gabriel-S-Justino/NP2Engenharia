"""Identidade verificada no Neon Auth. Identificadores de conversa nunca autenticam usuários."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit

import jwt
from fastapi import Request
from jwt import PyJWKClient

from app.core.errors import AppError


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None
    name: str | None = None


@lru_cache(maxsize=8)
def jwks_client(base_url: str) -> PyJWKClient:
    return PyJWKClient(base_url.rstrip("/") + "/.well-known/jwks.json", cache_keys=True, lifespan=300, timeout=8)


def require_user(request: Request) -> AuthUser:
    settings = request.app.state.settings
    base_url = settings.neon_auth_base_url
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise AppError("Entre na sua conta para acessar as conversas.", code="login_necessario", status_code=401)
    if not base_url or not base_url.startswith("https://"):
        raise AppError("O acesso às contas ainda não está configurado.", code="autenticacao_indisponivel", status_code=503)
    token = authorization[7:].strip()
    try:
        key = jwks_client(base_url).get_signing_key_from_jwt(token).key
        parsed = urlsplit(base_url)
        issuer = f"{parsed.scheme}://{parsed.netloc}"
        claims = jwt.decode(token, key, algorithms=["EdDSA"], issuer=issuer, audience=issuer,
                            options={"require": ["exp", "iat", "sub", "iss", "aud"]}, leeway=15)
        if not isinstance(claims["sub"], str) or not claims["sub"]:
            raise jwt.InvalidTokenError()
        return AuthUser(id=claims["sub"], email=claims.get("email"), name=claims.get("name"))
    except jwt.PyJWKClientConnectionError as exc:
        raise AppError("Não foi possível validar o acesso agora. Tente novamente.", code="autenticacao_indisponivel", status_code=503) from exc
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise AppError("Sua sessão expirou ou não é válida. Entre novamente.", code="sessao_invalida", status_code=401) from exc
