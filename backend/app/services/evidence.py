"""Avaliação da suficiência das evidências recuperadas.

Além do limiar de similaridade, medimos a **cobertura ponderada por IDF** dos termos
da pergunta nos trechos recuperados. Termos raros no acervo (ex.: "celular") pesam
mais do que termos onipresentes (ex.: "trânsito"). Se o termo central da pergunta não
aparece em nenhum trecho, a evidência é considerada insuficiente mesmo que haja
trechos "parecidos" acima do limiar — esse é o caso típico de informação ausente.

Também há uma heurística simples de **divergência**: valores numéricos diferentes
para a mesma unidade (dias, anos, pontos, km/h, R$, %) em documentos distintos, nos
trechos mais relevantes, geram o aviso de possível conflito entre fontes.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass

from app.services.embeddings import content_terms, light_stem, normalize_token_text

# Palavras que expressam o TIPO de pergunta ("quanto tempo", "qual o valor", "o que diz"), e não o
# conteúdo buscado. São ignoradas apenas no cálculo de cobertura, pois raramente aparecem no texto-fonte.
QUESTION_SCAFFOLDING = {
    light_stem(normalize_token_text(w))
    for w in (
        "tempo prazo valor valores custo custa custam quantidade número numero vale valem significa significado "
        "diz dizem fala falam explica explique existe existem informa informe sobre segundo conforme acordo "
        "regra regras devo deve devem posso pode podem preciso precisa precisam permitido permitida obrigatório "
        "obrigatória funciona funcionam acontece ocorre faço fazer dura durante cerca aproximadamente"
    ).split()
}

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?;])\s+")
_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")
# Abreviações comuns em textos normativos que não encerram frases ("Art. 4º", "nº.", "inc.").
_ABBREVIATIONS = re.compile(r"\b(Art|art|Arts|arts|n|nº|Inc|inc|par|al|Sr|Sra|Dr|Dra|p|pág|cap|Cap|Lei|ex)\.\s", re.UNICODE)
_NUMBER_UNIT = re.compile(
    r"(R\$\s*\d[\d.]*(?:,\d+)?|\d[\d.]*(?:,\d+)?)\s*(dias|dia|anos|ano|meses|m[eê]s|pontos|ponto|km/h|horas|hora|%|metros|reais)?",
    re.IGNORECASE,
)


class TermStatistics:
    """Frequência de documentos (chunks) por termo, para ponderação IDF."""

    def __init__(self, texts: Iterable[str]):
        self.df: Counter[str] = Counter()
        self.n = 0
        for text in texts:
            self.n += 1
            self.df.update(set(content_terms(text)))

    def idf(self, term: str) -> float:
        return math.log((self.n + 1) / (self.df.get(term, 0) + 1)) + 1.0


@dataclass
class Coverage:
    ratio: float
    missing_terms: list[str]
    covered_terms: list[str]


def weighted_coverage(question: str, texts: list[str], stats: TermStatistics) -> Coverage:
    q_terms = [t for t in dict.fromkeys(content_terms(question)) if t not in QUESTION_SCAFFOLDING]
    if not q_terms:
        return Coverage(0.0, [], [])
    available: set[str] = set()
    for text in texts:
        available.update(content_terms(text))
    total = sum(stats.idf(t) for t in q_terms)
    covered = [t for t in q_terms if t in available]
    missing = [t for t in q_terms if t not in available]
    ratio = sum(stats.idf(t) for t in covered) / total if total else 0.0
    return Coverage(ratio, missing, covered)


def is_heading_line(line: str) -> bool:
    line = line.strip()
    return bool(line) and (line.isupper() or bool(re.match(r"^(CAP[ÍI]TULO|SE[ÇC][ÃA]O|T[ÍI]TULO)\b", line)))


def split_sentences(text: str) -> list[str]:
    """Divide em frases. Quebras de linha simples (comuns na extração de PDF) não encerram frases."""
    sentences: list[str] = []
    for paragraph in _PARAGRAPH_SPLIT.split(text):
        lines = [line.strip() for line in paragraph.split("\n") if line.strip()]
        # Linhas de título isoladas permanecem como unidades próprias.
        buffer: list[str] = []
        for line in lines:
            if is_heading_line(line):
                if buffer:
                    sentences += _split_paragraph(" ".join(buffer))
                    buffer = []
                sentences.append(line)
            else:
                buffer.append(line)
        if buffer:
            sentences += _split_paragraph(" ".join(buffer))
    return [s for s in sentences if len(s) > 15]


def _split_paragraph(paragraph: str) -> list[str]:
    protected = _ABBREVIATIONS.sub(lambda m: m.group(0).replace(". ", ".\u0000"), paragraph)
    return [part.replace("\u0000", " ").strip() for part in _SENTENCE_SPLIT.split(protected) if part.strip()]


def sentence_score(question_terms: list[str], sentence: str, stats: TermStatistics) -> float:
    terms = set(content_terms(sentence))
    return sum(stats.idf(t) for t in question_terms if t in terms)


def _numbers_by_unit(text: str) -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for match in _NUMBER_UNIT.finditer(text):
        value, unit = match.group(1), (match.group(2) or "").lower()
        if value.startswith("R$"):
            unit, value = "reais", value.replace("R$", "").strip()
        if not unit:
            continue
        unit = {"dia": "dias", "ano": "anos", "mês": "meses", "mes": "meses", "ponto": "pontos", "hora": "horas"}.get(unit, unit)
        found.setdefault(unit, set()).add(value.rstrip(".,"))
    return found


def detect_conflicts(sentences_by_document: dict[str, list[str]]) -> list[str]:
    """Retorna descrições de possíveis divergências entre documentos distintos."""
    if len(sentences_by_document) < 2:
        return []
    per_doc = {doc: _numbers_by_unit(" ".join(sents)) for doc, sents in sentences_by_document.items()}
    conflicts = []
    docs = list(per_doc)
    for i, a in enumerate(docs):
        for b in docs[i + 1:]:
            for unit in set(per_doc[a]) & set(per_doc[b]):
                if per_doc[a][unit].isdisjoint(per_doc[b][unit]):
                    conflicts.append(
                        f"Valores diferentes para '{unit}' em fontes distintas: "
                        f"{', '.join(sorted(per_doc[a][unit]))} ({a}) e {', '.join(sorted(per_doc[b][unit]))} ({b})."
                    )
    return conflicts
