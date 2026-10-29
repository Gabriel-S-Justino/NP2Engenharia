"""Aplicação FastAPI do Acervo IA.

Execução local:  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 (a partir de backend/)
Documentação:    http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.routes import router
from app.core.config import Settings, get_settings
from app.core.container import Container
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging

logger = logging.getLogger("acervo")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        container = Container(settings)
        app.state.container = container
        container.startup()
        logger.info("api_iniciada", extra={"env": settings.app_env, "llm": settings.llm_provider,
                                           "embeddings": settings.embedding_provider})
        yield
        container.shutdown()

    app = FastAPI(
        title="Acervo IA — API",
        version=__version__,
        description=(
            "API do assistente de consulta documental com RAG (Retrieval-Augmented Generation). "
            "Respostas fundamentadas apenas nos documentos indexados, com citações verificáveis e "
            "recusa segura quando não há evidência suficiente."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Admin-Token"],
        max_age=600,
    )

    max_body = settings.max_request_body_mb * 1024 * 1024

    @app.middleware("http")
    async def limit_body_and_secure_headers(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > max_body:
            return JSONResponse(status_code=413, content={"error": {
                "code": "requisicao_muito_grande", "message": "A requisição excede o tamanho máximo permitido."}})
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        return response

    app.include_router(router)

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"name": "Acervo IA API", "version": __version__, "docs": "/docs", "health": "/api/health"}

    return app


app = create_app()
