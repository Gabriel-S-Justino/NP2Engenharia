"""Erros de aplicação com mensagens públicas seguras.

Mensagens destinadas ao usuário nunca incluem stack traces, caminhos locais ou
variáveis de ambiente. Detalhes técnicos vão apenas para o log do servidor.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("acervo.errors")


class AppError(Exception):
    status_code = 400
    code = "erro_aplicacao"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = 404
    code = "nao_encontrado"


class ConflictError(AppError):
    status_code = 409
    code = "conflito"


class ForbiddenError(AppError):
    status_code = 403
    code = "acesso_negado"


class PayloadTooLargeError(AppError):
    status_code = 413
    code = "arquivo_muito_grande"


class UnsupportedMediaError(AppError):
    status_code = 415
    code = "tipo_nao_suportado"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "servico_indisponivel"


class RateLimitedError(AppError):
    status_code = 429
    code = "limite_requisicoes"


def _body(code: str, message: str, details: object | None = None) -> dict:
    payload: dict = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return payload


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"campo": ".".join(str(p) for p in err.get("loc", []) if p != "body"), "mensagem": err.get("msg")}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_body("entrada_invalida", "Os dados enviados são inválidos.", details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "Erro na requisição."
        if exc.status_code == 404 and message == "Not Found":
            message = "Recurso não encontrado."
        if exc.status_code == 405:
            message = "Método não permitido para este recurso."
        return JSONResponse(status_code=exc.status_code, content=_body(f"http_{exc.status_code}", message))

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("erro_inesperado", extra={"path": request.url.path})
        return JSONResponse(
            status_code=500,
            content=_body("erro_interno", "Ocorreu um erro interno. Tente novamente mais tarde."),
        )
