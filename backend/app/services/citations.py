"""Construção e validação de citações.

As citações exibidas são montadas exclusivamente a partir dos metadados reais dos
trechos recuperados pelo backend. O modelo só pode referenciar rótulos (F1, F2…) que
foram entregues a ele; qualquer rótulo desconhecido é removido e sinalizado.
"""

from __future__ import annotations

import re

from app.schemas.models import Citation
from app.services.retrieval import RetrievedChunk

_LABEL = re.compile(r"\[(F\d{1,2})\]")
_LABEL_GROUP = re.compile(r"\[(F\d{1,2}(?:\s*[,;]\s*F\d{1,2})+)\]")


def label_for(index: int) -> str:
    return f"F{index + 1}"


def build_citation(label: str, item: RetrievedChunk, *, cited: bool, excerpt_chars: int = 600) -> Citation:
    meta = item.metadata
    text = item.row["text"]
    excerpt = text if len(text) <= excerpt_chars else text[:excerpt_chars].rsplit(" ", 1)[0] + "…"
    return Citation(
        label=label,
        source_id=item.row["id"],
        document_id=item.row["document_id"],
        document_title=item.title,
        filename=item.row["filename"],
        page=item.row["page"],
        section=item.row["section"],
        excerpt=excerpt,
        relevance=round(item.score, 4),
        url=meta.get("url"),
        license=meta.get("license"),
        author=meta.get("author"),
        institution=meta.get("institution"),
        published_date=meta.get("published_date"),
        version=meta.get("version"),
        origin=item.row["origin"],
        suspicious=bool(item.row["suspicious"]),
        cited_in_answer=cited,
    )


def normalize_label_groups(text: str) -> str:
    """Converte "[F1, F2]" em "[F1][F2]" para validação uniforme."""
    return _LABEL_GROUP.sub(lambda m: "".join(f"[{p.strip()}]" for p in re.split(r"[,;]", m.group(1))), text)


def extract_labels(text: str) -> list[str]:
    return list(dict.fromkeys(_LABEL.findall(normalize_label_groups(text))))


def validate_and_clean(text: str, allowed: set[str]) -> tuple[str, list[str], list[str]]:
    """Remove rótulos inexistentes. Retorna (texto limpo, rótulos válidos, rótulos inválidos)."""
    text = normalize_label_groups(text)
    labels = extract_labels(text)
    invalid = [label for label in labels if label not in allowed]
    for label in invalid:
        text = text.replace(f"[{label}]", "")
    valid = [label for label in labels if label in allowed]
    return text.strip(), valid, invalid
