"""Calibra o limiar de similaridade (SIMILARITY_THRESHOLD) para o modelo de embeddings atual.

Para cada pergunta do conjunto de calibração, mede a maior similaridade de cosseno
recuperada. Depois procura o limiar que melhor separa perguntas respondíveis das não
respondíveis (maior acurácia; em empate, a margem mais equilibrada). O resultado é uma
SUGESTÃO para a equipe, registrada em docs/resultados/.

Uso (a partir da raiz do repositório):
    python scripts/calibrate_threshold.py                       # conjunto sintético
    python scripts/calibrate_threshold.py --set tests/acceptance/calibracao_real.json --real
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import Settings  # noqa: E402
from app.services.pipeline import RagPipeline  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--set", default=str(ROOT / "tests/acceptance/calibracao_fixtures.json"))
    parser.add_argument("--real", action="store_true", help="Usa o acervo principal (Documentos/) em vez das fixtures")
    parser.add_argument("--output", default=str(ROOT / "docs/resultados"))
    args = parser.parse_args()

    data = json.loads(Path(args.set).read_text(encoding="utf-8"))
    settings = Settings()
    if args.real:
        pipeline = RagPipeline(settings, data_dir=settings.data_dir,
                               sources=[("documentos", settings.documents_dir), ("upload", settings.uploads_dir)])
    else:
        tmp = Path(tempfile.mkdtemp(prefix="calibracao_"))
        pipeline = RagPipeline(settings, data_dir=tmp, sources=[("fixtures", settings.fixtures_dir)], name="calibracao")
    pipeline.startup()
    pipeline.ingestion.start("scan", wait=True)
    pipeline.set_overrides({"similarity_threshold": -1.0})

    rows = []
    for item in data["questions"]:
        response = pipeline.answer(item["question"], persist=False)
        best = response.retrieval.best_score if response.retrieval else None
        rows.append({"question": item["question"], "answerable": item["answerable"], "best": best})

    scores = sorted({r["best"] for r in rows if r["best"] is not None})
    candidates = [round(s + 1e-4, 4) for s in scores] + [round(scores[0] - 1e-4, 4)] if scores else []
    best_threshold, best_key = None, None
    for t in candidates:
        correct = sum((r["best"] is not None and r["best"] >= t) == r["answerable"] for r in rows)
        pos = [r["best"] for r in rows if r["answerable"] and r["best"] is not None and r["best"] >= t]
        neg = [r["best"] for r in rows if not r["answerable"] and r["best"] is not None and r["best"] < t]
        margin = min((min(pos) - t) if pos else 0, (t - max(neg)) if neg else 0)
        key = (correct, margin)
        if best_key is None or key > best_key:
            best_threshold, best_key = t, key
    # Centraliza o limiar no intervalo entre as classes, quando separáveis.
    pos_all = [r["best"] for r in rows if r["answerable"] and r["best"] is not None]
    neg_all = [r["best"] for r in rows if not r["answerable"] and r["best"] is not None]
    separable = bool(pos_all and neg_all and min(pos_all) > max(neg_all))
    suggestion = round((min(pos_all) + max(neg_all)) / 2, 3) if separable else best_threshold
    accuracy = best_key[0] / len(rows) if best_key else None

    embed = pipeline.embedder
    lines = [
        f"# Calibração do limiar — {embed.fingerprint}",
        "",
        f"- Data: {datetime.now(UTC).isoformat(timespec='seconds')}",
        f"- Conjunto: `{Path(args.set).name}` ({len(rows)} perguntas; acervo {'real' if args.real else 'sintético de teste'})",
        f"- Embeddings semânticos: {'sim' if embed.semantic else 'NÃO (hashing lexical)'}",
        f"- Classes separáveis: {'sim' if separable else 'não'}",
        f"- Menor similaridade entre respondíveis: {min(pos_all):.4f}" if pos_all else "- Sem perguntas respondíveis",
        f"- Maior similaridade entre não respondíveis: {max(neg_all):.4f}" if neg_all else "- Sem perguntas não respondíveis",
        f"- **Limiar sugerido: {suggestion}** (acurácia de separação no conjunto: {accuracy:.0%})",
        "",
        "| Pergunta | Respondível? | Maior similaridade |",
        "|---|---|---|",
    ]
    for r in sorted(rows, key=lambda x: -(x["best"] or -9)):
        lines.append(f"| {r['question']} | {'sim' if r['answerable'] else 'não'} | {r['best']:.4f} |" if r["best"] is not None
                     else f"| {r['question']} | {'sim' if r['answerable'] else 'não'} | — |")
    # Verificação de ponta a ponta com o limiar sugerido (inclui a checagem de cobertura de termos).
    pipeline.set_overrides({"similarity_threshold": suggestion})
    final_ok = 0
    lines += ["", f"## Comportamento final com limiar {suggestion}", "",
              "| Pergunta | Esperado | Status obtido | Correto? |", "|---|---|---|---|"]
    for r in rows:
        status = pipeline.answer(r["question"], persist=False).status
        ok = (status == "answered") == r["answerable"]
        final_ok += ok
        lines.append(f"| {r['question']} | {'responder' if r['answerable'] else 'recusar'} | {status} | {'sim' if ok else 'NÃO'} |")
    lines += ["", f"Acurácia de ponta a ponta no conjunto de calibração: {final_ok}/{len(rows)} ({final_ok / len(rows):.0%})."]
    lines += ["", "Observação: o limiar é apenas a primeira barreira; perguntas no domínio com informação ausente "
              "são tratadas também pela cobertura de termos (MIN_TERM_COVERAGE) e pelo LLM (SEM_EVIDENCIA)."]
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"calibracao_{embed.name}{'_real' if args.real else '_fixtures'}.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nRelatório salvo em {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    pipeline.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
