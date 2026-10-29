"""Inventário da pasta Documentos/: arquivos, páginas, texto extraível e metadados.

Verifica automaticamente apenas o que é mensurável (quantidade de documentos, páginas com
texto, metadados preenchidos). Se o conteúdo é "útil" para as consultas é uma decisão da
equipe, registrada em docs/FONTES.md.

Uso: python scripts/inventario_documentos.py [--markdown docs/resultados/inventario_documentos.md]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import _bootstrap  # noqa: F401

from app.core.config import get_settings
from app.services.document_loader import DocumentReadError, load_document
from app.services.ingestion import METADATA_FIELDS, discover, load_manifest

MIN_DOCUMENTS = 10
MIN_PAGES = 25


def main() -> int:
    parser = argparse.ArgumentParser(description="Inventário do acervo")
    parser.add_argument("--markdown", default=None, help="Grava o inventário em Markdown neste caminho")
    args = parser.parse_args()
    settings = get_settings()
    root = settings.documents_dir
    files, skipped = discover("documentos", root)
    manifest = load_manifest(root)
    rows, total_pages, total_chars = [], 0, 0
    for f in files:
        entry = manifest.get(f.relative_path, {})
        filled = [k for k in METADATA_FIELDS if entry.get(k)]
        try:
            doc = load_document(f.path)
            pages_with_text = sum(1 for p in doc.pages if len(p.text.strip()) > 200)
            chars = sum(len(p.text) for p in doc.pages)
            status = "ok"
        except DocumentReadError as exc:
            pages_with_text, chars, status = 0, 0, f"erro: {exc}"
        # TXT sem paginação: estimativa de ~2.500 caracteres por página.
        equivalent = pages_with_text if f.path.suffix.lower() == ".pdf" else max(pages_with_text, round(chars / 2500))
        total_pages += equivalent
        total_chars += chars
        rows.append((f.relative_path, equivalent, chars, len(filled), status))

    docs_ok = len(files) >= MIN_DOCUMENTS
    pages_ok = total_pages >= MIN_PAGES
    lines = [
        "# Inventário de Documentos/",
        "",
        f"- Pasta: `{root}`",
        f"- Documentos suportados: **{len(files)}** (ignorados: {skipped})",
        f"- Páginas (ou equivalentes) com texto extraível: **{total_pages}**",
        f"- Caracteres extraídos: {total_chars}",
        f"- Critério automático (≥{MIN_DOCUMENTS} documentos OU ≥{MIN_PAGES} páginas): "
        f"**{'ATENDIDO' if docs_ok or pages_ok else 'NÃO ATENDIDO'}** — a utilidade do conteúdo depende da validação da equipe.",
        "",
        "| Arquivo | Páginas c/ texto | Caracteres | Metadados preenchidos | Leitura |",
        "|---|---|---|---|---|",
    ]
    for path, pages, chars, filled, status in rows:
        lines.append(f"| {path} | {pages} | {chars} | {filled}/{len(METADATA_FIELDS)} | {status} |")
    if not rows:
        lines.append("| (pasta vazia — adicione os documentos reais da equipe) | 0 | 0 | — | — |")
    report = "\n".join(lines)
    print(report)
    if args.markdown:
        out = Path(args.markdown)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
