"""Limpeza conservadora do texto extraído.

Remove ruídos típicos de extração (hifenização em quebra de linha, espaços
repetidos, caracteres de controle) sem reescrever nem resumir o conteúdo.
"""

from __future__ import annotations

import re
import unicodedata

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
_SPACES = re.compile(r"[ \t ]+")
_MANY_NEWLINES = re.compile(r"\n{3,}")
_PAGE_NUMBER_LINE = re.compile(r"^\s*(p[áa]gina\s+)?\d{1,4}(\s*(de|/)\s*\d{1,4})?\s*$", re.IGNORECASE)


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub(" ", text)
    text = _HYPHEN_BREAK.sub(r"\1\2", text)
    lines = []
    for line in text.split("\n"):
        line = _SPACES.sub(" ", line).strip()
        # Linhas que contêm apenas o número da página são ruído de rodapé.
        if _PAGE_NUMBER_LINE.match(line):
            continue
        lines.append(line)
    text = "\n".join(lines)
    text = _MANY_NEWLINES.sub("\n\n", text)
    return text.strip()
