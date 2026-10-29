"""Divisão do texto em trechos (chunks) com sobreposição.

Unidade: caracteres. Cada chunk pertence a uma única página de um único documento,
o que garante que a citação aponte para a página correta. A seção é detectada por
heurística (títulos, "Art. N", "CAPÍTULO", "Seção") e propagada entre páginas.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from app.services.document_loader import PageText
from app.services.text_cleaner import clean_text

_HEADING_PATTERNS = [
    re.compile(r"^#{1,6}\s+.+"),
    re.compile(r"^(CAP[ÍI]TULO|T[ÍI]TULO|SE[ÇC][ÃA]O|ANEXO|PARTE)\b.*", re.IGNORECASE),
    re.compile(r"^Art(igo|\.)\s*\d+[º°o]?\b.*", re.IGNORECASE),
    re.compile(r"^\d+(\.\d+)*\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?]{2,80}$"),
]
_SENTENCE_END = re.compile(r"(?<=[.!?;:])\s+")


def detect_heading(line: str) -> str | None:
    line = line.strip()
    if not line or len(line) > 120:
        return None
    for pattern in _HEADING_PATTERNS:
        if pattern.match(line):
            heading = line.lstrip("#").strip()
            # Para artigos, a seção é apenas o rótulo "Art. N".
            article = re.match(r"^(Art(?:igo|\.)\s*\d+[º°o]?)", heading, re.IGNORECASE)
            return article.group(1) if article else heading[:100]
    if line.isupper() and 4 <= len(line) <= 80 and any(c.isalpha() for c in line):
        return line.title()
    return None


@dataclass
class Chunk:
    id: str
    document_id: str
    ordinal: int
    page: int | None
    section: str | None
    text: str
    char_start: int  # posição relativa ao texto limpo da página
    char_end: int

    @property
    def content_sha(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()


def _split_units(text: str, chunk_size: int) -> list[tuple[int, int]]:
    """Retorna intervalos (início, fim) de unidades: parágrafos, frases ou cortes por palavra."""
    units: list[tuple[int, int]] = []
    for para in re.finditer(r"[^\n]+(?:\n(?!\n)[^\n]+)*", text):
        start, end = para.span()
        if end - start <= chunk_size:
            units.append((start, end))
            continue
        cursor = start
        for sentence_end in [m.start() for m in _SENTENCE_END.finditer(text, start, end)] + [end]:
            while sentence_end - cursor > chunk_size:
                cut = text.rfind(" ", cursor, cursor + chunk_size)
                cut = cut if cut > cursor else cursor + chunk_size
                units.append((cursor, cut))
                cursor = cut
                while cursor < end and text[cursor].isspace():
                    cursor += 1
            if sentence_end > cursor:
                units.append((cursor, sentence_end))
                cursor = sentence_end
                while cursor < end and text[cursor].isspace():
                    cursor += 1
    return units


def _overlap_start(text: str, end: int, overlap: int, floor: int) -> int:
    if overlap <= 0:
        return end
    start = max(floor, end - overlap)
    # Ajusta para começar no início de uma palavra.
    space = text.find(" ", start, end)
    return space + 1 if space != -1 and space + 1 < end else start


def chunk_pages(
    document_id: str,
    pages: list[PageText],
    *,
    chunk_size: int,
    chunk_overlap: int,
    min_chunk_chars: int,
) -> list[Chunk]:
    chunks: list[Chunk] = []
    section: str | None = None
    ordinal = 0
    for page in pages:
        text = clean_text(page.text)
        if not text:
            continue
        # Mapa de posição -> seção vigente, a partir dos títulos detectados.
        heading_marks: list[tuple[int, str]] = []
        offset = 0
        for line in text.split("\n"):
            heading = detect_heading(line)
            if heading:
                heading_marks.append((offset, heading))
            offset += len(line) + 1

        def section_at(pos: int, current: str | None, heading_marks=heading_marks) -> str | None:
            for mark_pos, heading in heading_marks:
                if mark_pos <= pos:
                    current = heading
                else:
                    break
            return current

        page_chunks: list[tuple[int, int]] = []
        units = _split_units(text, chunk_size)
        win_start: int | None = None
        win_end = 0
        for u_start, u_end in units:
            if win_start is None:
                win_start, win_end = u_start, u_end
                continue
            # Um novo título encerra o trecho atual: chunks não misturam seções diferentes.
            first_line = text[u_start:u_end].split("\n", 1)[0]
            if detect_heading(first_line) and win_end - win_start >= min_chunk_chars:
                page_chunks.append((win_start, win_end))
                win_start, win_end = u_start, u_end
                continue
            if u_end - win_start <= chunk_size:
                win_end = u_end
                continue
            page_chunks.append((win_start, win_end))
            next_start = _overlap_start(text, win_end, chunk_overlap, win_start + 1)
            win_start = min(next_start, u_start)
            win_end = u_end
            if win_end - win_start > chunk_size:  # sobreposição não cabe junto da próxima unidade
                win_start = u_start
        if win_start is not None:
            page_chunks.append((win_start, win_end))

        # Junta um trecho final muito curto ao anterior da mesma página.
        if len(page_chunks) >= 2 and page_chunks[-1][1] - page_chunks[-1][0] < min_chunk_chars:
            last = page_chunks.pop()
            prev = page_chunks.pop()
            page_chunks.append((prev[0], last[1]))

        page_section_start = section
        for start, end in page_chunks:
            body = text[start:end].strip()
            if len(body) < min_chunk_chars and len(page_chunks) > 1:
                continue
            if not body:
                continue
            chunk_section = section_at(end - 1, page_section_start)
            # Se o trecho começa num título, a seção é esse título.
            first_heading = section_at(start, page_section_start)
            ordinal += 1
            chunks.append(
                Chunk(
                    id=f"{document_id}-c{ordinal:04d}",
                    document_id=document_id,
                    ordinal=ordinal,
                    page=page.page,
                    section=first_heading or chunk_section,
                    text=body,
                    char_start=start,
                    char_end=end,
                )
            )
        section = section_at(len(text), page_section_start)
    return chunks
