"""Controles de acesso, limite de requisições e validação de caminhos/arquivos."""

from __future__ import annotations

import hmac
import re
import threading
import time
import unicodedata
from collections import defaultdict, deque
from pathlib import Path

from fastapi import Request

from app.core.config import Settings
from app.core.errors import ForbiddenError, RateLimitedError

ADMIN_HEADER = "X-Admin-Token"


def require_admin(request: Request) -> None:
    """Exige o token administrativo nas operações que alteram o acervo.

    * Sem ADMIN_TOKEN em desenvolvimento: liberado (uso local controlado).
    * Sem ADMIN_TOKEN em produção: operações administrativas bloqueadas.
    """
    settings: Settings = request.app.state.container.settings
    if not settings.admin_required:
        return
    if settings.admin_token is None:
        raise ForbiddenError(
            "Operações administrativas estão desabilitadas: configure ADMIN_TOKEN no servidor.",
            code="admin_desabilitado",
        )
    provided = request.headers.get(ADMIN_HEADER, "")
    if not hmac.compare_digest(provided.encode(), settings.admin_token.get_secret_value().encode()):
        raise ForbiddenError("Token administrativo ausente ou inválido.", code="token_invalido")


class RateLimiter:
    """Janela deslizante de 60 s por cliente, em memória (suficiente para uma instância)."""

    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        if self.per_minute <= 0:
            return
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > 60:
                hits.popleft()
            if len(hits) >= self.per_minute:
                raise RateLimitedError("Muitas perguntas em pouco tempo. Aguarde um minuto e tente novamente.")
            hits.append(now)


def client_key(request: Request) -> str:
    settings: Settings = request.app.state.container.settings
    if settings.app_env == "production":
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


def rate_limit_chat(request: Request) -> None:
    request.app.state.container.rate_limiter.check(client_key(request))


_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._ \-()]+")


def sanitize_filename(filename: str) -> str:
    """Remove diretórios, caracteres de controle e sequências perigosas do nome enviado."""
    name = filename.replace("\\", "/").split("/")[-1]
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = _UNSAFE_CHARS.sub("_", name).strip(" ._")
    name = re.sub(r"_+", "_", name)
    if not name or name.startswith("."):
        name = "documento"
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    stem = stem[:100] or "documento"
    return f"{stem}.{ext.lower()}" if ext else stem


def safe_child(root: Path, relative: str) -> Path:
    """Resolve um caminho garantindo que permaneça dentro de `root` (proteção contra path traversal)."""
    root_resolved = root.resolve()
    target = (root_resolved / relative).resolve()
    try:
        target.relative_to(root_resolved)
    except ValueError as exc:
        raise ForbiddenError("Caminho de arquivo inválido.", code="caminho_invalido") from exc
    return target
