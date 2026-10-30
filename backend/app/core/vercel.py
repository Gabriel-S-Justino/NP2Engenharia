"""Adaptador ASGI para a função da Vercel.

O `vercel.json` reescreve `/api/<caminho>` para a função `/api/index` (a Vercel anexa `?path=<caminho>`).
Dependendo de como a plataforma entrega a requisição, o FastAPI pode receber o caminho original
(`/api/chat`) ou o destino da reescrita (`/api/index?path=chat`). Este adaptador normaliza o segundo caso
para o primeiro, de modo que as rotas `/api/...` funcionem em ambas as situações.
"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode


class RestoreRewrittenPath:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in ("http", "websocket") and scope.get("path", "").rstrip("/") == "/api/index":
            pairs = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
            original = next((value for key, value in pairs if key == "path"), None)
            if original is not None:
                rest = [(k, v) for k, v in pairs if k != "path"]
                path = "/api/" + original.lstrip("/")
                scope = {**scope, "path": path, "raw_path": path.encode(), "query_string": urlencode(rest).encode()}
        await self.app(scope, receive, send)
