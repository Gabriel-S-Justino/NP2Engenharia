"""Contexto conversacional limitado. Histórico ajuda a resolver referências e nunca vira fonte factual."""

from __future__ import annotations

import re
from html import escape

from app.schemas.models import ChatResponse

_REFERENCE = re.compile(r"\b(isso|isto|essa|esse|dessa|desse|anterior|melhor|mais detalhes|e quanto|e para|por qu[eê])\b", re.I)


def retrieval_question(question: str, history: list[ChatResponse] | None) -> str:
    if not history or not _REFERENCE.search(question):
        return question
    previous = " ".join(item.question for item in history[-2:])[-800:]
    return f"{question}\nAssunto anterior: {previous}"


def history_context(history: list[ChatResponse] | None) -> str:
    if not history:
        return ""
    parts = ["<historico_nao_verificado>"]
    for item in history:
        # F1 de uma resposta antiga não é F1 da recuperação atual.
        answer = re.sub(r"\[F\d+\]", "", item.answer or "")
        parts += [f"<turno><pergunta>{escape(item.question)}</pergunta>",
                  f"<resposta>{escape(answer)}</resposta></turno>"]
    parts += ["</historico_nao_verificado>",
              "O histórico só esclarece referências da pergunta. Ele não é evidência. "
              "Sustente fatos e citações exclusivamente nas fontes recuperadas nesta requisição."]
    return "\n".join(parts)


def bounded_history(history: list[ChatResponse] | None, turns: int, chars: int) -> list[ChatResponse]:
    result: list[ChatResponse] = []
    size = 0
    for item in reversed((history or [])[-turns:] if turns else []):
        if item.status != "answered":
            continue
        cost = len(item.question) + len(item.answer or "")
        if size + cost > chars:
            break
        result.append(item)
        size += cost
    return list(reversed(result))
