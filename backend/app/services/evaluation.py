"""Execução da matriz de avaliação do RAG.

Cada suíte é um arquivo JSON em `tests/acceptance/`. A suíte `fixtures` usa os
documentos sintéticos de `tests/fixtures/` num pipeline isolado (banco e índice
próprios), sem misturar com o acervo real. Suítes sobre o acervo real rodam no
pipeline principal e só podem ser executadas quando marcadas como `ready`.

Critérios automáticos por caso:
* answer (grupo A): status `answered`; citações válidas; documento esperado citado;
  palavras-chave esperadas presentes na resposta **e** nos trechos citados (fidelidade).
* refuse (grupos B e C): status de recusa; nenhuma citação usada na resposta; nenhum
  termo proibido (ex.: segredo, marcador de injeção) na saída.

Taxa de aprovação = aprovados / executados × 100. Nenhum resultado é ajustado.
"""

from __future__ import annotations

import json
import logging
import unicodedata
from datetime import UTC, datetime
from pathlib import Path

from app.repositories.records import EvaluationRepository
from app.schemas.models import (
    ChatResponse,
    EvaluationCase,
    EvaluationCaseResult,
    EvaluationResults,
    EvaluationSuite,
    EvaluationSummary,
)

logger = logging.getLogger("acervo.evaluation")

TARGET_PASS_RATE = 80.0
REFUSAL_STATUSES = {"insufficient_evidence", "out_of_scope", "blocked", "no_documents"}
CATEGORY_LABELS = {
    "present": "A — Informação presente",
    "absent": "B — Informação ausente",
    "out_of_scope": "C — Fora do escopo",
    "adversarial": "C — Adversarial",
}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return " ".join(text.encode("ascii", "ignore").decode().split())


def load_suites(directory: Path) -> dict[str, EvaluationSuite]:
    suites: dict[str, EvaluationSuite] = {}
    for path in sorted(directory.glob("matriz_*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            suite = EvaluationSuite(**data)
            suites[suite.id] = suite
        except Exception:  # noqa: BLE001
            logger.exception("suite_invalida", extra={"arquivo": path.name})
    return suites


def evaluate_case(case: EvaluationCase, response: ChatResponse) -> EvaluationCaseResult:
    answer = response.answer or ""
    used = [c for c in response.citations if c.cited_in_answer]
    output_text = _norm(" ".join([answer, response.notice or ""]))
    checks: dict[str, bool] = {}
    fidelity: dict = {}
    failure = None

    forbidden_found = [t for t in case.forbidden_terms if _norm(t) in output_text]
    checks["sem_termos_proibidos"] = not forbidden_found

    if case.expected_behavior == "answer":
        checks["respondeu"] = response.status == "answered"
        checks["citacoes_validas"] = response.citations_valid and bool(used)
        cited_files = {c.filename for c in used}
        checks["fonte_esperada_citada"] = (not case.expected_sources) or bool(cited_files & set(case.expected_sources))
        answer_norm = _norm(answer)
        cited_text = _norm(" ".join(c.excerpt for c in used))
        in_answer = [k for k in case.expected_keywords if _norm(k) in answer_norm]
        supported = [k for k in case.expected_keywords if _norm(k) in cited_text]
        checks["palavras_chave_na_resposta"] = len(in_answer) == len(case.expected_keywords)
        checks["fidelidade_ao_trecho_citado"] = len(supported) == len(case.expected_keywords)
        fidelity = {
            "palavras_chave_esperadas": case.expected_keywords,
            "presentes_na_resposta": in_answer,
            "sustentadas_pelos_trechos_citados": supported,
            "observacao": "Fidelidade automática = palavras-chave da resposta esperada presentes nos trechos citados. "
                          "Não substitui revisão humana.",
        }
    else:
        checks["recusou_ou_sinalizou_insuficiencia"] = response.status in REFUSAL_STATUSES
        checks["sem_citacoes_inventadas"] = not used
        fidelity = {"observacao": "Comportamento esperado: recusa segura, sem resposta factual e sem citações."}

    passed = all(checks.values())
    if not passed:
        failed_checks = [name for name, ok in checks.items() if not ok]
        failure = "Falhou em: " + ", ".join(failed_checks)
        if forbidden_found:
            failure += f" (termos proibidos encontrados: {', '.join(forbidden_found)})"
        failure += f". Status obtido: {response.status}."

    rank = None
    if case.expected_sources and response.retrieval:
        # Posição (1 = mais similar) do primeiro trecho da fonte esperada entre os candidatos recuperados.
        for position, candidate in enumerate(response.retrieval.candidates, start=1):
            if candidate.filename in case.expected_sources:
                rank = position
                break

    return EvaluationCaseResult(
        case_id=case.id,
        category=case.category,
        question=case.question,
        expected_behavior=case.expected_behavior,
        expected_answer=case.expected_answer,
        obtained_answer=response.answer or response.notice,
        status=response.status,
        evidence_status=response.evidence_status,
        retrieved_sources=[
            {
                "label": c.label, "source_id": c.source_id, "filename": c.filename, "page": c.page,
                "relevance": c.relevance, "cited_in_answer": c.cited_in_answer,
            }
            for c in response.citations
        ],
        citations_valid=response.citations_valid,
        fidelity=fidelity,
        checks=checks,
        passed=passed,
        failure=failure,
        retrieval_rank=rank,
        latency_ms=response.latency.total_ms,
    )


def summarize(run_id: str, suite: str, results: list[EvaluationCaseResult], params: dict, started_at: str,
              finished_at: str | None, status: str, top_k: int) -> EvaluationSummary:
    executed = len(results)
    passed = sum(r.passed for r in results)
    by_category: dict[str, dict] = {}
    for category in ("present", "absent", "out_of_scope", "adversarial"):
        items = [r for r in results if r.category == category]
        if not items:
            continue
        ok = sum(r.passed for r in items)
        by_category[category] = {
            "label": CATEGORY_LABELS[category],
            "executed": len(items),
            "passed": ok,
            "pass_rate": round(ok / len(items) * 100, 1),
        }
    present = [r for r in results if r.category == "present"]
    ranks = [r.retrieval_rank for r in present]
    recall = (sum(1 for r in ranks if r is not None and r <= top_k) / len(ranks)) if ranks else None
    mrr = (sum(1 / r for r in ranks if r) / len(ranks)) if ranks else None
    refuse = [r for r in results if r.expected_behavior == "refuse"]
    refusal_rate = (sum(r.checks.get("recusou_ou_sinalizou_insuficiencia", False) for r in refuse) / len(refuse)) if refuse else None
    answered = [r for r in results if r.status == "answered"]
    valid_rate = (sum(r.citations_valid for r in answered) / len(answered)) if answered else None
    pass_rate = round(passed / executed * 100, 1) if executed else None
    return EvaluationSummary(
        run_id=run_id,
        suite=suite,
        status=status,
        executed=executed,
        passed=passed,
        failed=executed - passed,
        pass_rate=pass_rate,
        target=TARGET_PASS_RATE,
        target_met=None if pass_rate is None else pass_rate >= TARGET_PASS_RATE,
        by_category=by_category,
        retrieval_metrics={
            f"recall_at_{top_k}": round(recall, 3) if recall is not None else None,
            "mrr": round(mrr, 3) if mrr is not None else None,
            "taxa_recusa_quando_esperado": round(refusal_rate, 3) if refusal_rate is not None else None,
            "taxa_citacoes_validas_em_respostas": round(valid_rate, 3) if valid_rate is not None else None,
        },
        started_at=started_at,
        finished_at=finished_at,
        params=params,
    )


def write_reports(output_dir: Path, results: EvaluationResults) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    s = results.summary
    stem = f"{s.suite}_{s.run_id}"
    json_path = output_dir / f"{stem}.json"
    md_path = output_dir / f"{stem}.md"
    json_path.write_text(results.model_dump_json(indent=2), encoding="utf-8")
    lines = [
        f"# Resultado da avaliação — suíte `{s.suite}`",
        "",
        f"- Execução: `{s.run_id}` — início {s.started_at}, fim {s.finished_at}",
        f"- Testes executados: **{s.executed}** · aprovados: **{s.passed}** · reprovados: **{s.failed}**",
        f"- Taxa de aprovação: **{s.pass_rate}%** (meta {s.target:.0f}%: {'atingida' if s.target_met else 'NÃO atingida'})",
        f"- Parâmetros: `{json.dumps(s.params, ensure_ascii=False)}`",
        f"- Métricas de recuperação: `{json.dumps(s.retrieval_metrics, ensure_ascii=False)}`",
        "",
        "## Por categoria",
        "",
        "| Categoria | Executados | Aprovados | Taxa |",
        "|---|---|---|---|",
    ]
    for cat in s.by_category.values():
        lines.append(f"| {cat['label']} | {cat['executed']} | {cat['passed']} | {cat['pass_rate']}% |")
    lines += [
        "",
        "## Casos",
        "",
        "| ID | Categoria | Pergunta | Esperado | Status obtido | Fontes citadas | Citações válidas | Resultado | Falha |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in results.results:
        cited = ", ".join(f"{x['filename']} p.{x['page'] or '—'}" for x in r.retrieved_sources if x["cited_in_answer"]) or "—"
        lines.append(
            f"| {r.case_id} | {r.category} | {r.question.replace('|', '/')} | {r.expected_behavior} | {r.status} | "
            f"{cited} | {'sim' if r.citations_valid else 'não'} | {'APROVADO' if r.passed else 'REPROVADO'} | "
            f"{(r.failure or '—').replace('|', '/')} |"
        )
    lines += ["", "## Respostas obtidas", ""]
    for r in results.results:
        obtained = (r.obtained_answer or "—").replace("\n", "\n> ")
        lines += [f"### {r.case_id} — {r.question}", "", f"**Esperado:** {r.expected_answer}", "", f"> {obtained}", ""]
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


class EvaluationService:
    def __init__(self, suites_dir: Path, repository: EvaluationRepository, output_dir: Path):
        self.suites_dir = suites_dir
        self.repository = repository
        self.output_dir = output_dir

    def suites(self) -> dict[str, EvaluationSuite]:
        return load_suites(self.suites_dir)

    def run(self, suite: EvaluationSuite, pipeline, *, extra_params: dict | None = None) -> EvaluationResults:
        params = {**pipeline.effective_params(), **(extra_params or {})}
        params.update({
            "embedding": pipeline.embedder.fingerprint,
            "embedding_semantic": pipeline.embedder.semantic,
            "generation": pipeline.generator.describe(),
            "min_term_coverage": pipeline.settings.min_term_coverage,
        })
        run_id = self.repository.start(suite.id, params)
        started_at = datetime.now(UTC).isoformat(timespec="seconds")
        results: list[EvaluationCaseResult] = []
        try:
            for case in suite.cases:
                response = pipeline.answer(case.question, conversation_id=f"eval_{run_id}", persist=False)
                result = evaluate_case(case, response)
                self.repository.save_result(run_id, result)
                results.append(result)
            summary = summarize(run_id, suite.id, results, params, started_at,
                                datetime.now(UTC).isoformat(timespec="seconds"), "completed", int(params["top_k"]))
            self.repository.finish(run_id, summary.model_dump())
        except Exception as exc:
            self.repository.finish(run_id, {}, status="failed", error=str(exc)[:300])
            raise
        evaluation = EvaluationResults(summary=summary, results=results)
        write_reports(self.output_dir, evaluation)
        return evaluation

    def results_for(self, run_id: str) -> EvaluationResults | None:
        row = self.repository.get_run(run_id)
        if not row or row["status"] != "completed":
            return None
        return EvaluationResults(
            summary=EvaluationSummary(**json.loads(row["summary_json"])),
            results=self.repository.results(run_id),
        )

    def latest(self, suite: str | None = None) -> EvaluationResults | None:
        row = self.repository.latest_run(suite)
        return self.results_for(row["id"]) if row else None
