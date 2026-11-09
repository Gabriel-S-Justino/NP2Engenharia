"""Prepara e avalia o acervo real com a configuração atual, sem exigir edição de código.

Uso: backend/.venv/Scripts/python.exe scripts/prepare_real.py
Não publica nem altera credenciais. O limiar só é aplicado se a calibração em
perguntas separadas produzir classes separáveis e pelo menos 80% de acerto final.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(*arguments: str) -> None:
    subprocess.run([sys.executable, *arguments], cwd=ROOT, check=True)


def main() -> int:
    os.environ.setdefault("PYTHONUTF8", "1")
    import _bootstrap  # noqa: F401

    from app.core.config import Settings
    from app.services.ingestion import discover

    settings = Settings()
    if not discover("documentos", settings.documents_dir)[0]:
        raise SystemExit("Acervo vazio. Adicione seus documentos manualmente em Documentos/ antes de preparar.")
    suite = json.loads((settings.evaluation_dir / "matriz_acervo_real.json").read_text(encoding="utf-8"))
    calibration = json.loads((ROOT / "tests/acceptance/calibracao_real.json").read_text(encoding="utf-8"))
    if not suite.get("ready") or not calibration.get("questions"):
        raise SystemExit("Preencha a matriz e a calibração com seu acervo manual e marque a matriz como ready antes de preparar.")
    run("scripts/inventario_documentos.py", "--markdown", "docs/resultados/inventario_documentos.md")
    run("scripts/ingest_documents.py")
    run("scripts/calibrate_threshold.py", "--set", "tests/acceptance/calibracao_real.json", "--real")
    sys.path.insert(0, str(ROOT / "backend"))
    from app.services.pipeline import RagPipeline

    report = ROOT / "docs/resultados" / f"calibracao_{settings.embedding_provider}_real.json"
    result = json.loads(report.read_text(encoding="utf-8"))
    if not result["separable"] or result["end_to_end_correct"] / result["questions"] < 0.8:
        raise SystemExit("Calibração inconclusiva. Limiar preservado; consulte o relatório antes de aplicar ajustes.")
    pipeline = RagPipeline(settings, data_dir=settings.data_dir, sources=[("documentos", settings.documents_dir)])
    try:
        pipeline.startup()
        if pipeline.embedder.fingerprint != result["embedding_fingerprint"]:
            raise SystemExit("Modelo diferente da calibração; limiar preservado.")
        pipeline.set_overrides({"similarity_threshold": result["suggested_threshold"]})
    finally:
        pipeline.close()
    run("scripts/run_evaluation.py", "--suite", "acervo_real", "--copy-to", "docs/resultados")
    print("Acervo indexado, limiar calibrado e meta da matriz atingida. Revise as respostas com a equipe.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
