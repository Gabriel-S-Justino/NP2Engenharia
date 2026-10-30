"""Repositórios de histórico de chat, execuções de ingestão, avaliações e diário da IA mentora."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta

from app.repositories.database import Database, now_iso
from app.schemas.models import (
    ChatResponse,
    EvaluationCaseResult,
    IngestionRun,
    IngestionStats,
    MentorEntry,
    MentorEntryIn,
)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


class IngestionRunRepository:
    def __init__(self, db: Database):
        self.db = db

    def start(self, kind: str) -> IngestionRun:
        run = IngestionRun(id=new_id("ing"), kind=kind, status="running", started_at=now_iso(), stats=IngestionStats())
        self.db.execute(
            "INSERT INTO ingestion_runs(id, kind, status, started_at, stats_json) VALUES(?, ?, ?, ?, ?)",
            (run.id, run.kind, run.status, run.started_at, run.stats.model_dump_json()),
        )
        return run

    def update(self, run: IngestionRun) -> None:
        self.db.execute(
            "UPDATE ingestion_runs SET status = ?, finished_at = ?, stats_json = ?, error_message = ? WHERE id = ?",
            (run.status, run.finished_at, run.stats.model_dump_json(), run.error_message, run.id),
        )

    def last(self) -> IngestionRun | None:
        row = self.db.query_one("SELECT * FROM ingestion_runs WHERE status != 'running' ORDER BY started_at DESC, id DESC LIMIT 1")
        if not row:
            return None
        return IngestionRun(
            id=row["id"], kind=row["kind"], status=row["status"], started_at=row["started_at"],
            finished_at=row["finished_at"], stats=IngestionStats.model_validate_json(row["stats_json"]),
            error_message=row["error_message"],
        )

    def mark_stale_running_as_failed(self, older_than_seconds: float = 0) -> None:
        """Execuções interrompidas (reinício do servidor, função encerrada) ficam registradas como falha.

        Em ambiente com várias instâncias, só marca execuções mais antigas que o tempo máximo de uma execução.
        """
        cutoff = (datetime.now(UTC) - timedelta(seconds=older_than_seconds)).isoformat(timespec="milliseconds")
        self.db.execute(
            """UPDATE ingestion_runs SET status = 'failed', finished_at = ?, error_message = ?
               WHERE status = 'running' AND started_at <= ?""",
            (now_iso(), "Execução interrompida antes de terminar.", cutoff),
        )

    def success_rate(self) -> float | None:
        rows = self.db.query("SELECT stats_json FROM ingestion_runs WHERE status = 'completed'")
        ok = failed = 0
        for row in rows:
            stats = json.loads(row["stats_json"])
            ok += stats.get("new", 0) + stats.get("updated", 0)
            failed += stats.get("failed", 0)
        return None if ok + failed == 0 else ok / (ok + failed)


class ChatRepository:
    def __init__(self, db: Database):
        self.db = db

    def save(self, response: ChatResponse) -> None:
        self.db.execute(
            """INSERT INTO chat_interactions(id, conversation_id, question, answer, status, evidence_status,
               payload_json, retrieval_ms, generation_ms, total_ms, citations_count, citations_valid, created_at)
               VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                response.interaction_id, response.conversation_id, response.question, response.answer,
                response.status, response.evidence_status, response.model_dump_json(),
                response.latency.retrieval_ms, response.latency.generation_ms, response.latency.total_ms,
                len(response.citations), int(response.citations_valid), response.created_at,
            ),
        )

    def history(self, conversation_id: str, limit: int = 100) -> list[ChatResponse]:
        rows = self.db.query(
            "SELECT payload_json FROM chat_interactions WHERE conversation_id = ? ORDER BY created_at ASC, id ASC LIMIT ?",
            (conversation_id, limit),
        )
        return [ChatResponse.model_validate_json(r["payload_json"]) for r in rows]

    def clear(self, conversation_id: str) -> int:
        return self.db.execute("DELETE FROM chat_interactions WHERE conversation_id = ?", (conversation_id,)).rowcount

    def purge_older_than(self, days: int) -> int:
        if days <= 0:
            return 0
        cutoff = (datetime.now(UTC) - timedelta(days=days)).isoformat(timespec="seconds")
        return self.db.execute("DELETE FROM chat_interactions WHERE created_at < ?", (cutoff,)).rowcount

    def metrics(self) -> dict:
        row = self.db.query_one(
            """SELECT COUNT(*) AS total,
                      SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) AS answered,
                      SUM(CASE WHEN status IN ('insufficient_evidence','out_of_scope','blocked','no_documents') THEN 1 ELSE 0 END) AS refusals,
                      AVG(retrieval_ms) AS avg_retrieval, AVG(generation_ms) AS avg_generation, AVG(total_ms) AS avg_total,
                      AVG(CASE WHEN status = 'answered' THEN citations_count END) AS avg_sources,
                      AVG(CASE WHEN status = 'answered' THEN citations_valid END) AS valid_rate
               FROM chat_interactions"""
        )
        return dict(row) if row else {}


class EvaluationRepository:
    def __init__(self, db: Database):
        self.db = db

    def start(self, suite: str, params: dict) -> str:
        run_id = new_id("eval")
        self.db.execute(
            "INSERT INTO evaluation_runs(id, suite, status, started_at, params_json) VALUES(?, ?, 'running', ?, ?)",
            (run_id, suite, now_iso(), json.dumps(params, ensure_ascii=False)),
        )
        return run_id

    def finish(self, run_id: str, summary: dict, *, status: str = "completed", error: str | None = None) -> None:
        self.db.execute(
            "UPDATE evaluation_runs SET status = ?, finished_at = ?, summary_json = ?, error_message = ? WHERE id = ?",
            (status, now_iso(), json.dumps(summary, ensure_ascii=False), error, run_id),
        )

    def save_result(self, run_id: str, result: EvaluationCaseResult) -> None:
        self.db.execute(
            """INSERT INTO evaluation_results(run_id, case_id, category, passed, result_json) VALUES(?, ?, ?, ?, ?)
               ON CONFLICT(run_id, case_id) DO UPDATE SET category = excluded.category, passed = excluded.passed,
               result_json = excluded.result_json""",
            (run_id, result.case_id, result.category, int(result.passed), result.model_dump_json()),
        )

    def set_adjustment(self, run_id: str, case_id: str, adjustment: str) -> bool:
        cursor = self.db.execute(
            "UPDATE evaluation_results SET adjustment = ?, adjustment_at = ? WHERE run_id = ? AND case_id = ?",
            (adjustment, now_iso(), run_id, case_id),
        )
        return cursor.rowcount > 0

    def get_run(self, run_id: str):
        return self.db.query_one("SELECT * FROM evaluation_runs WHERE id = ?", (run_id,))

    def latest_run(self, suite: str | None = None):
        if suite:
            return self.db.query_one(
                "SELECT * FROM evaluation_runs WHERE suite = ? AND status = 'completed' ORDER BY started_at DESC, id DESC LIMIT 1",
                (suite,),
            )
        return self.db.query_one(
            "SELECT * FROM evaluation_runs WHERE status = 'completed' ORDER BY started_at DESC, id DESC LIMIT 1"
        )

    def list_runs(self, limit: int = 20):
        return self.db.query("SELECT * FROM evaluation_runs ORDER BY started_at DESC, id DESC LIMIT ?", (limit,))

    def results(self, run_id: str) -> list[EvaluationCaseResult]:
        rows = self.db.query(
            "SELECT result_json, adjustment, adjustment_at FROM evaluation_results WHERE run_id = ? ORDER BY case_id",
            (run_id,),
        )
        out = []
        for row in rows:
            result = EvaluationCaseResult.model_validate_json(row["result_json"])
            result.adjustment, result.adjustment_at = row["adjustment"], row["adjustment_at"]
            out.append(result)
        return out


class MentorRepository:
    def __init__(self, db: Database):
        self.db = db

    def add(self, entry: MentorEntryIn) -> MentorEntry:
        saved = MentorEntry(id=new_id("mentor"), created_at=now_iso(), **entry.model_dump())
        self.db.execute(
            """INSERT INTO mentor_log(id, entry_date, stage, prompt, response, evidence, decision, change_made,
               test_executed, result_before, result_after, author, created_at)
               VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (saved.id, saved.entry_date, saved.stage, saved.prompt, saved.response, saved.evidence, saved.decision,
             saved.change_made, saved.test_executed, saved.result_before, saved.result_after, saved.author,
             saved.created_at),
        )
        return saved

    def list(self) -> list[MentorEntry]:
        rows = self.db.query("SELECT * FROM mentor_log ORDER BY entry_date DESC, created_at DESC")
        return [MentorEntry(**dict(r)) for r in rows]
