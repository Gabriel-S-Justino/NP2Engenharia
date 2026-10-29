"""Logging estruturado em JSON, sem conteúdo sensível.

Perguntas de usuários não são registradas integralmente no log; registramos apenas
o tamanho e um hash curto, suficiente para correlacionar eventos.
"""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from datetime import UTC, datetime

_RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__ if record.exc_info[0] else None
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    if any(isinstance(h.formatter, JsonFormatter) for h in root.handlers):
        root.setLevel(level.upper())
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Bibliotecas ruidosas
    for name in ("httpx", "httpcore", "anthropic", "faiss"):
        logging.getLogger(name).setLevel(logging.WARNING)


def fingerprint_text(text: str) -> str:
    """Hash curto para correlacionar uma pergunta nos logs sem registrar seu conteúdo."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]
