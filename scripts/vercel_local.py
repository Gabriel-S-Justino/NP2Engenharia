"""Simulação local do deploy na Vercel (sem conta/CLI), para validar a configuração antes de publicar.

Reproduz o essencial do `vercel.json`:
* arquivos estáticos de `apps/mobile/dist` (build do Expo) com fallback de SPA para `/index.html`;
* `/api/*` atendido pela aplicação exportada em `api/index.py`, com `VERCEL=1` (modo serverless);
* sem eventos de ciclo de vida (lifespan), como em funções serverless.

Uso (na raiz, com DATABASE_URL de um Postgres com pgvector e o build web feito sem EXPO_PUBLIC_API_URL):
    VERCEL=1 DATABASE_URL=postgresql://... ADMIN_TOKEN=... backend/.venv/bin/python scripts/vercel_local.py --port 3000
"""

from __future__ import annotations

import argparse
import importlib.util
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "apps" / "mobile" / "dist"


def load_function_app():
    os.environ.setdefault("VERCEL", "1")
    spec = importlib.util.spec_from_file_location("vercel_api_index", ROOT / "api" / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def build_app():
    from starlette.responses import FileResponse

    api_app = load_function_app()

    async def app(scope, receive, send):
        if scope["type"] == "lifespan":  # a Vercel não garante lifespan: ignoramos de propósito
            message = await receive()
            while message["type"] != "lifespan.shutdown":
                if message["type"] == "lifespan.startup":
                    await send({"type": "lifespan.startup.complete"})
                message = await receive()
            await send({"type": "lifespan.shutdown.complete"})
            return
        path = scope.get("path", "/")
        if path == "/api" or path.startswith("/api/"):
            await api_app(scope, receive, send)
            return
        candidate = (DIST / path.lstrip("/")).resolve()
        if not str(candidate).startswith(str(DIST.resolve())) or not candidate.is_file():
            candidate = DIST / "index.html"
        await FileResponse(candidate)(scope, receive, send)

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=3000)
    args = parser.parse_args()
    if not (DIST / "index.html").exists():
        raise SystemExit("Build web ausente: rode `npm run build:web --prefix apps/mobile` (sem EXPO_PUBLIC_API_URL).")
    import uvicorn

    uvicorn.run(build_app(), host="127.0.0.1", port=args.port, lifespan="on")


if __name__ == "__main__":
    main()
