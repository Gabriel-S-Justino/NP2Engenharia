"""Aviso de versão baseado na proveniência verificada da matriz real e no hash do arquivo."""

from __future__ import annotations

import json


def corpus_notice(settings, db) -> str | None:
    try:
        data = json.loads((settings.evaluation_dir / "matriz_acervo_real.json").read_text(encoding="utf-8"))
        source = data.get("provenance", {})
        if not source.get("sha256") or not source.get("notice"):
            return None
        row = db.query_one("SELECT 1 FROM documents WHERE sha256 = ? AND status = 'processed' LIMIT 1", (source["sha256"],))
        return source["notice"] if row else None
    except (OSError, ValueError, TypeError):
        return None
