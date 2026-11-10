"""Conversas por proprietário, feedback e cotas compartilhadas no banco."""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from app.core.errors import AppError, NotFoundError
from app.repositories.database import Database, now_iso


class ConversationRepository:
    def __init__(self, db: Database):
        self.db = db

    def require(self, conversation_id: str, owner: str):
        row = self.db.query_one("SELECT * FROM chat_conversations WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
                                (conversation_id, owner))
        if row is None:
            raise NotFoundError("Conversa não encontrada.")
        return row

    def ensure(self, conversation_id: str | None, owner: str, question: str) -> str:
        conversation_id = conversation_id or f"conv_{uuid.uuid4().hex}"
        stamp = now_iso()
        with self.db.transaction() as conn:
            legacy = conn.execute("SELECT 1 FROM chat_interactions WHERE conversation_id = ? LIMIT 1", (conversation_id,)).fetchone()
            current = conn.execute("SELECT owner_id, deleted_at FROM chat_conversations WHERE id = ?", (conversation_id,)).fetchone()
            if current is None and legacy is not None:
                # A posse de um ID antigo não comprova quem era o usuário anônimo.
                raise NotFoundError("Esta conversa anterior precisa ser vinculada por um administrador.")
            conn.execute(
                """INSERT INTO chat_conversations(id, owner_id, title, created_at, updated_at)
                   VALUES(?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING""",
                (conversation_id, owner, " ".join(question.split())[:100] or "Nova conversa", stamp, stamp),
            )
            row = conn.execute("SELECT owner_id, deleted_at FROM chat_conversations WHERE id = ?", (conversation_id,)).fetchone()
            if row["owner_id"] != owner or row["deleted_at"] is not None:
                raise NotFoundError("Conversa não encontrada.")
        return conversation_id

    def touch(self, conversation_id: str, owner: str) -> None:
        self.db.execute("UPDATE chat_conversations SET updated_at = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
                        (now_iso(), conversation_id, owner))

    def list(self, owner: str, offset: int, limit: int) -> list[dict]:
        rows = self.db.query(
            """SELECT c.id, c.title, c.updated_at FROM chat_conversations c
               WHERE c.owner_id = ? AND c.deleted_at IS NULL
               AND EXISTS(SELECT 1 FROM chat_interactions i WHERE i.conversation_id = c.id)
               ORDER BY c.updated_at DESC, c.id DESC LIMIT ? OFFSET ?""", (owner, limit, offset))
        return [dict(r) for r in rows]

    def rename(self, conversation_id: str, owner: str, title: str) -> None:
        self.require(conversation_id, owner)
        self.db.execute("UPDATE chat_conversations SET title = ? WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
                        (title, conversation_id, owner))

    def delete(self, conversation_id: str, owner: str) -> int:
        with self.db.transaction() as conn:
            row = conn.execute("SELECT id FROM chat_conversations WHERE id = ? AND owner_id = ? AND deleted_at IS NULL",
                               (conversation_id, owner)).fetchone()
            if row is None:
                raise NotFoundError("Conversa não encontrada.")
            removed = conn.execute("DELETE FROM chat_interactions WHERE conversation_id = ?", (conversation_id,)).rowcount
            conn.execute("UPDATE chat_conversations SET title = 'Conversa excluída', deleted_at = ? WHERE id = ? AND owner_id = ?",
                         (now_iso(), conversation_id, owner))
        return removed

    def import_legacy(self, owner: str, conversation_ids: list[str]) -> int:
        imported = 0
        with self.db.transaction() as conn:
            for conversation_id in conversation_ids:
                first = conn.execute("SELECT question, created_at FROM chat_interactions WHERE conversation_id = ? ORDER BY created_at, id LIMIT 1",
                                     (conversation_id,)).fetchone()
                if first is None:
                    continue
                last = conn.execute("SELECT MAX(created_at) AS stamp FROM chat_interactions WHERE conversation_id = ?",
                                    (conversation_id,)).fetchone()
                result = conn.execute(
                    """INSERT INTO chat_conversations(id, owner_id, title, created_at, updated_at)
                       VALUES(?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING""",
                    (conversation_id, owner, first["question"][:100], first["created_at"], last["stamp"]),
                )
                imported += max(0, result.rowcount)
        return imported

    def feedback(self, interaction_id: str, owner: str, rating: int, comment: str) -> None:
        row = self.db.query_one(
            """SELECT i.id FROM chat_interactions i JOIN chat_conversations c ON c.id = i.conversation_id
               WHERE i.id = ? AND c.owner_id = ? AND c.deleted_at IS NULL""", (interaction_id, owner))
        if row is None:
            raise NotFoundError("Resposta não encontrada.")
        self.db.execute(
            """INSERT INTO chat_feedback(interaction_id, owner_id, rating, comment, updated_at) VALUES(?, ?, ?, ?, ?)
               ON CONFLICT(interaction_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment,
               updated_at = excluded.updated_at WHERE chat_feedback.owner_id = excluded.owner_id""",
            (interaction_id, owner, rating, comment, now_iso()),
        )


class UsageRepository:
    def __init__(self, db: Database):
        self.db = db

    @staticmethod
    def _key(scope: str, value: str, window: str) -> str:
        digest = hashlib.sha256(value.encode()).hexdigest()
        return f"{scope}:{digest}:{window}"

    def _buckets(self, owner: str, ip: str, settings, now: datetime):
        minute = now.strftime("%Y%m%d%H%M")
        day = now.strftime("%Y%m%d")
        minute_end = (now.replace(second=0, microsecond=0) + timedelta(minutes=1)).isoformat(timespec="milliseconds")
        day_end = (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat(timespec="milliseconds")
        return [
            (self._key("user-minute", owner, minute), settings.rate_limit_per_minute, minute_end),
            (self._key("ip-minute", ip, minute), settings.rate_limit_per_minute * 3, minute_end),
            (self._key("user-day", owner, day), settings.user_daily_questions, day_end),
            ("global-day:" + day, settings.global_daily_questions, day_end),
        ]

    def reserve(self, owner: str, ip: str, settings) -> None:
        now = datetime.now(UTC)
        with self.db.transaction() as conn:
            conn.execute("DELETE FROM usage_buckets WHERE expires_at < ?", (now.isoformat(timespec="milliseconds"),))
            for key, limit, expiry in self._buckets(owner, ip, settings, now):
                if limit <= 0:
                    continue
                row = conn.execute(
                    """INSERT INTO usage_buckets(key, hits, expires_at) VALUES(?, 1, ?)
                       ON CONFLICT(key) DO UPDATE SET hits = usage_buckets.hits + 1
                       WHERE usage_buckets.hits < ? RETURNING hits""", (key, expiry, limit)).fetchone()
                if row is None:
                    raise AppError("Seu limite de perguntas ou o limite do serviço foi atingido. Aguarde a renovação da cota.",
                                   code="cota_atingida", status_code=429)

    def status(self, owner: str, settings) -> dict:
        now = datetime.now(UTC)
        buckets = self._buckets(owner, "", settings, now)
        def count(key: str) -> int:
            row = self.db.query_one("SELECT hits FROM usage_buckets WHERE key = ?", (key,))
            return int(row["hits"]) if row else 0
        return {"daily_used": count(buckets[2][0]), "daily_limit": settings.user_daily_questions,
                "minute_used": count(buckets[0][0]), "minute_limit": settings.rate_limit_per_minute,
                "resets_at": buckets[2][2]}
