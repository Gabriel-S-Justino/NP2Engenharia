"""Indexa os documentos de Documentos/ (e uploads) pelo terminal, sem iniciar a API.

Uso (na raiz do repositório, com o ambiente do backend ativo):
    python scripts/ingest_documents.py            # indexa arquivos novos/alterados
    python scripts/ingest_documents.py --reindex  # reprocessa tudo (ex.: após trocar o modelo)
"""

from __future__ import annotations

import argparse
import json

import _bootstrap  # noqa: F401

from app.core.config import get_settings
from app.core.container import Container


def main() -> int:
    parser = argparse.ArgumentParser(description="Indexação do acervo Acervo IA")
    parser.add_argument("--reindex", action="store_true", help="Reprocessa todos os documentos")
    args = parser.parse_args()
    settings = get_settings()
    container = Container(settings)
    container.startup()
    pipeline = container.pipeline
    print(f"Pasta de documentos: {settings.documents_dir}")
    print(f"Embeddings: {settings.embedding_provider} / {settings.embedding_model}")
    if args.reindex or not pipeline.index_compatible:
        if not pipeline.index_compatible:
            print(f"Aviso: {pipeline.index_message}\nExecutando reindexação completa.")
        pipeline.reset_index()
        pipeline.ingestion.start("reindex", force=True, wait=True)
    else:
        pipeline.ingestion.start("scan", wait=True)
    run = pipeline.ingestion_runs.last()
    print(json.dumps(run.model_dump(), indent=2, ensure_ascii=False))
    for doc in pipeline.documents.list(page=1, page_size=500)[0]:
        flag = {"processed": "OK ", "failed": "ERRO", "excluded": "IGN"}.get(doc.status, doc.status)
        detail = f" — {doc.error_message}" if doc.error_message else ""
        print(f"[{flag}] {doc.relative_path} ({doc.chunk_count} trechos, {doc.page_count or '—'} pág.){detail}")
    container.shutdown()
    return 0 if run and run.status == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
