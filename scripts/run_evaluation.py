"""Executa a matriz de avaliação e grava os resultados em JSON e Markdown.

Uso:
    python scripts/run_evaluation.py                 # suíte sintética 'fixtures'
    python scripts/run_evaluation.py --suite acervo_real
    python scripts/run_evaluation.py --copy-to docs/resultados

O processo retorna código 0 quando a meta de 80% é atingida e 2 quando não é atingida
(útil em CI). Os resultados nunca são ajustados: o que foi executado é o que é reportado.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import _bootstrap  # noqa: F401

from app.core.config import get_settings
from app.core.container import Container
from app.services.evaluation import write_reports


def main() -> int:
    parser = argparse.ArgumentParser(description="Matriz de avaliação do Acervo IA")
    parser.add_argument("--suite", default="fixtures")
    parser.add_argument("--copy-to", default=None, help="Copia os relatórios gerados para esta pasta")
    args = parser.parse_args()
    container = Container(get_settings())
    container.startup()
    state = container.run_evaluation(args.suite, wait=True)
    if state["status"] != "completed":
        print(f"Falha na avaliação: {state['error']}")
        return 1
    results = container.evaluations.results_for(state["run_id"])
    s = results.summary
    print(f"Suíte: {s.suite} | executados: {s.executed} | aprovados: {s.passed} | taxa: {s.pass_rate}% "
          f"| meta 80%: {'ATINGIDA' if s.target_met else 'NÃO ATINGIDA'}")
    for cat in s.by_category.values():
        print(f"  {cat['label']}: {cat['passed']}/{cat['executed']} ({cat['pass_rate']}%)")
    print(f"  Métricas de recuperação: {s.retrieval_metrics}")
    for r in results.results:
        print(f"  [{'OK ' if r.passed else 'FALHA'}] {r.case_id} {r.status:22s} {r.question[:70]}")
        if r.failure:
            print(f"        {r.failure}")
    if args.copy_to:
        dest = Path(args.copy_to)
        json_path, md_path = write_reports(dest, results)
        latest = dest / f"ultima_execucao_{s.suite}.md"
        shutil.copyfile(md_path, latest)
        print(f"Relatórios copiados para {dest} (resumo em {latest.name})")
    container.shutdown()
    return 0 if s.target_met else 2


if __name__ == "__main__":
    raise SystemExit(main())
