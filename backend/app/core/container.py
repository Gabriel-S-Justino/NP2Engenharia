"""Contêiner de dependências da aplicação.

Criado no startup do FastAPI (servidor local) ou sob demanda na primeira requisição (funções serverless,
onde eventos de ciclo de vida podem não ser executados).
"""

from __future__ import annotations

import logging
import threading

from app.core.config import Settings
from app.core.errors import ConflictError, NotFoundError
from app.core.security import RateLimiter
from app.repositories.records import EvaluationRepository, MentorRepository
from app.schemas.models import EvaluationResults
from app.services.evaluation import EvaluationService
from app.services.pipeline import RagPipeline

logger = logging.getLogger("acervo.container")


class Container:
    def __init__(self, settings: Settings):
        settings.ensure_directories()
        self.settings = settings
        self.pipeline = RagPipeline(
            settings,
            data_dir=settings.data_dir,
            sources=[("documentos", settings.documents_dir)],
            name="principal",
        )
        self.evaluations = EvaluationService(
            settings.evaluation_dir, EvaluationRepository(self.pipeline.db), settings.evaluation_output_dir
        )
        self.mentor = MentorRepository(self.pipeline.db)
        self.rate_limiter = RateLimiter(settings.rate_limit_per_minute)
        self._fixtures_pipeline: RagPipeline | None = None
        self._eval_lock = threading.Lock()
        self.current_evaluation: dict | None = None

    def startup(self) -> None:
        self.pipeline.startup()
        removed = self.pipeline.chat.purge_older_than(self.settings.history_retention_days)
        if removed:
            logger.info("historico_expurgado", extra={"removidos": removed})
        if self.settings.auto_ingest_on_startup and self.pipeline.index_compatible:
            try:
                self.pipeline.ingestion.start("startup")
            except ConflictError:
                pass

    def fixtures_pipeline(self) -> RagPipeline:
        """Pipeline isolado para os documentos sintéticos de teste (banco e índice próprios)."""
        if self._fixtures_pipeline is None:
            embedder = self.pipeline.ensure_embedder()
            # Sempre local e descartável (SQLite + vetores em arquivo): é reconstruído a cada avaliação e nunca
            # se mistura ao acervo real. Os RESULTADOS da avaliação ficam no banco principal (persistente).
            store = "numpy" if self.settings.vector_store == "pgvector" else self.settings.vector_store
            self._fixtures_pipeline = RagPipeline(
                self.settings,
                data_dir=self.settings.data_dir / "eval_fixtures",
                sources=[("fixtures", self.settings.fixtures_dir)],
                embedder=embedder,
                generator=self.pipeline.generator,
                name="fixtures",
                use_postgres=False,
                vector_store=store,
                accept_uploads=False,
            )
            self._fixtures_pipeline.startup()
        # Mesmos parâmetros de recuperação do acervo principal, para comparar resultados.
        self._fixtures_pipeline.db.set_kv("settings_overrides", self.pipeline.db.get_kv("settings_overrides") or "{}")
        return self._fixtures_pipeline

    def run_evaluation(self, suite_id: str, *, wait: bool) -> dict:
        if self.settings.serverless:
            wait = True  # funções serverless não mantêm tarefas em segundo plano após a resposta
        suites = self.evaluations.suites()
        suite = suites.get(suite_id)
        if suite is None:
            raise NotFoundError(f"Suíte de avaliação '{suite_id}' não encontrada.")
        if not suite.ready:
            raise ConflictError(
                f"A suíte '{suite_id}' ainda não está pronta: a equipe precisa preencher as respostas esperadas "
                "a partir das fontes reais e marcar \"ready\": true no arquivo JSON.",
                code="suite_nao_pronta",
            )
        if not self._eval_lock.acquire(blocking=False):
            raise ConflictError("Já existe uma avaliação em execução.", code="avaliacao_em_andamento")
        state = {"suite": suite_id, "status": "running", "run_id": None, "error": None}
        self.current_evaluation = state

        def target() -> None:
            try:
                if suite.synthetic:
                    pipeline = self.fixtures_pipeline()
                    pipeline.ingestion.start("scan", wait=True)
                else:
                    pipeline = self.pipeline
                result: EvaluationResults = self.evaluations.run(suite, pipeline)
                state.update(status="completed", run_id=result.summary.run_id)
            except Exception as exc:  # noqa: BLE001
                logger.exception("avaliacao_falhou")
                state.update(status="failed", error=getattr(exc, "message", None) or "Falha ao executar a avaliação.")
            finally:
                self._eval_lock.release()

        if wait:
            target()
        else:
            threading.Thread(target=target, name=f"evaluation-{suite_id}", daemon=True).start()
        return state

    def shutdown(self) -> None:
        self.pipeline.ingestion.join(timeout=5)
        self.pipeline.close()
        if self._fixtures_pipeline:
            self._fixtures_pipeline.close()


_container_lock = threading.Lock()


def get_container(app) -> Container:
    """Retorna o contêiner da aplicação, criando-o na primeira requisição se o startup não tiver ocorrido."""
    container = getattr(app.state, "container", None)
    if container is None:
        with _container_lock:
            container = getattr(app.state, "container", None)
            if container is None:
                container = Container(app.state.settings)
                container.startup()
                app.state.container = container
    return container
