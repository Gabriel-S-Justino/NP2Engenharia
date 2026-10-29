"""Proteções contra instruções maliciosas (prompt injection) e vazamento de segredos.

A detecção é heurística (padrões em português e inglês). Ela não substitui as demais
camadas: separação estrutural entre instruções e contexto, validação das citações no
backend e ausência de segredos no contexto enviado ao modelo.
"""

from __future__ import annotations

import re

_INJECTION_PATTERNS = [
    r"\b(ignore|ignora|ignorar|desconsidere|desconsiderar|esque[cç]a|esquecer)\b.{0,40}\b(instru[cç][oõ]es|regras|orienta[cç][oõ]es|comandos|anteriores|acima|politicas|pol[ií]ticas)",
    r"\bignore\b.{0,30}\b(previous|above|prior|all)\b.{0,20}\b(instructions|rules)",
    r"\b(prompt|mensagem|instru[cç][aã]o)\s+(do|de)\s+sistema\b",
    r"\bsystem\s+prompt\b",
    r"\b(revele|revelar|mostre|mostrar|exiba|exibir|imprima|imprimir|informe|vaze|vazar)\b.{0,40}\b(prompt|segredo|segredos|senha|senhas|chave|chaves|token|tokens|credencia(l|is)|vari[aá]veis de ambiente|\.env)\b",
    r"\b(api[\s_-]?key|chave\s+(de\s+)?api|llm_api_key|admin_token|anthropic_api_key)\b",
    r"\b(voc[eê]\s+agora\s+[eé]|a\s+partir\s+de\s+agora\s+voc[eê]|you\s+are\s+now|act\s+as|aja\s+como|finja\s+(ser|que))\b",
    r"\b(modo\s+desenvolvedor|developer\s+mode|jailbreak|\bDAN\b)",
    r"\b(responda|responder)\b.{0,30}\b(sem\s+(usar|consultar|citar)\s+(as\s+)?(fontes|documentos)|com\s+conhecimento\s+geral|livremente)\b",
    r"\bn[aã]o\s+(cite|use|siga)\b.{0,20}\b(fontes|regras|documentos)\b",
]
_INJECTION_RE = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in _INJECTION_PATTERNS]


def detect_injection(text: str) -> list[str]:
    """Retorna os trechos que casaram com padrões de instrução maliciosa."""
    matches = []
    for pattern in _INJECTION_RE:
        match = pattern.search(text)
        if match:
            matches.append(match.group(0)[:120])
    return matches


def looks_like_injection(text: str) -> bool:
    return bool(detect_injection(text))


def strip_injection_sentences(text: str) -> tuple[str, int]:
    """Remove frases com formato de instrução. Retorna (texto, quantidade removida)."""
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    kept, removed = [], 0
    for sentence in sentences:
        if sentence.strip() and looks_like_injection(sentence):
            removed += 1
            continue
        kept.append(sentence)
    return " ".join(s for s in kept if s.strip()), removed


def escape_context(text: str) -> str:
    """Impede que o conteúdo recuperado feche ou abra as tags que delimitam o contexto."""
    return re.sub(r"</?\s*(documento|fonte|contexto|sistema|system|instru[cç][aã]o)[^>]*>", "[tag removida]", text, flags=re.IGNORECASE)


def scrub_secrets(text: str, secrets: list[str]) -> tuple[str, bool]:
    leaked = False
    for secret in secrets:
        if secret and len(secret) >= 8 and secret in text:
            text = text.replace(secret, "[removido]")
            leaked = True
    return text, leaked
