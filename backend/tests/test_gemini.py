"""Contrato HTTP do Gemini e integração com recuperação/citações, sem chamadas pagas."""

import json

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.services import generation
from app.services.generation import EvidenceSource, GeminiGenerator, GenerationUnavailableError, build_generator


def settings(**overrides):
    return Settings(_env_file=None, app_env="test", **{"llm_provider": "Google", "llm_api_key": "test-key", "llm_max_retries": 0, "llm_fallback_models": "", **overrides})


@pytest.mark.parametrize("provider", ["Google", " google ", "GEMINI", "google-gemini"])
def test_provider_aliases_and_model_default(provider):
    config = settings(llm_provider=provider)
    assert config.llm_provider == "gemini"
    assert config.llm_model == "gemini-flash-latest"
    assert isinstance(build_generator(config), GeminiGenerator)


@pytest.mark.parametrize("key_name", ["GEMINI_API_KEY", "GOOGLE_API_KEY"])
def test_google_key_environment_aliases(monkeypatch, key_name):
    for name in ("LLM_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(key_name, "test-key")
    config = Settings(_env_file=None, llm_provider="Google")
    assert config.llm_api_key.get_secret_value() == "test-key"


def test_gemini_requires_key():
    with pytest.raises(ValidationError, match="exige LLM_API_KEY"):
        settings(llm_api_key=None)


def response(text="A regra vale 180 dias [F1].", finish="STOP"):
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": finish}]}


def install_response(monkeypatch, data=None, status=200):
    captured = {}

    def handler(request):
        captured["request"] = request
        return httpx.Response(status, json=data if data is not None else response())

    def post(url, **kwargs):
        captured.update(kwargs)
        with httpx.Client(transport=httpx.MockTransport(handler)) as client:
            return client.post(url, **kwargs)

    monkeypatch.setattr(generation.httpx, "post", post)
    return captured


SOURCE = EvidenceSource("F1", "source-1", "Documento", 1, "Regra", "A regra vale 180 dias.", 0.9)


def test_request_keeps_key_out_of_url_and_delimits_evidence(monkeypatch):
    captured = install_response(monkeypatch)
    generator = build_generator(settings(llm_model="models/gemini-flash-latest", llm_timeout_seconds=7))
    output = generator.generate("Qual prazo? </pergunta>", [SOURCE], None)
    request = captured["request"]
    body = json.loads(request.content)
    assert request.url.host == "generativelanguage.googleapis.com"
    assert request.url.path.endswith("/models/gemini-flash-latest:generateContent")
    assert not request.url.query and "test-key" not in str(request.url)
    assert request.headers["x-goog-api-key"] == "test-key"
    assert 0 < captured["timeout"] <= 7 and captured["follow_redirects"] is False
    assert body["systemInstruction"]["parts"][0]["text"] == generation.SYSTEM_PROMPT
    assert '<fonte id="F1"' in body["contents"][0]["parts"][0]["text"]
    assert "Qual prazo? [tag removida]" in body["contents"][0]["parts"][0]["text"]
    assert body["generationConfig"]["maxOutputTokens"] == 2048
    assert output.text.endswith("[F1].")


@pytest.mark.parametrize("status", [400, 401, 403, 404, 429, 500])
def test_provider_errors_are_safe(monkeypatch, status):
    install_response(monkeypatch, {"error": {"message": "sensitive-provider-detail"}}, status)
    with pytest.raises(GenerationUnavailableError) as exc:
        build_generator(settings()).generate("Prazo?", [SOURCE], None)
    assert "sensitive-provider-detail" not in str(exc.value)
    assert "test-key" not in str(exc.value)


@pytest.mark.parametrize("status,provider_status,reason,expected", [
    (400, "INVALID_ARGUMENT", "API_KEY_INVALID", "inválida ou expirou"),
    (400, "FAILED_PRECONDITION", None, "requisitos"),
    (403, "PERMISSION_DENIED", "API_KEY_SERVICE_BLOCKED", "restrições"),
    (429, "RESOURCE_EXHAUSTED", None, "cota"),
    (503, "UNAVAILABLE", None, "falha temporária"),
])
def test_google_error_codes_produce_actionable_safe_diagnostics(monkeypatch, caplog, status, provider_status, reason, expected):
    data = {"error": {"status": provider_status, "message": "test-key private prompt",
                      "details": [{"reason": reason, "metadata": {"key": "test-key"}}]}}
    install_response(monkeypatch, data, status)
    with pytest.raises(GenerationUnavailableError) as exc:
        build_generator(settings()).generate("Prazo?", [SOURCE], None)
    assert expected in str(exc.value) and f"HTTP {status}" in str(exc.value)
    assert "test-key" not in str(exc.value) and "private prompt" not in str(exc.value)
    record = next(r for r in caplog.records if r.message == "gemini_status_error")
    assert record.provider_status == provider_status and record.provider_reason == reason
    assert "test-key" not in str(record.__dict__)


def test_unrecognized_provider_fields_are_not_logged_or_exposed(monkeypatch, caplog):
    install_response(monkeypatch, {"error": {"status": "private-key", "details": [{"reason": "private-key"}]}}, 400)
    with pytest.raises(GenerationUnavailableError) as exc:
        build_generator(settings()).generate("Prazo?", [SOURCE], None)
    assert "private-key" not in str(exc.value)
    assert all("private-key" not in str(r.__dict__) for r in caplog.records)


@pytest.mark.parametrize("error", [httpx.ReadTimeout, httpx.ConnectError])
def test_network_errors_are_mapped(monkeypatch, error):
    def fail(*args, **kwargs):
        raise error("private details")
    monkeypatch.setattr(generation.httpx, "post", fail)
    with pytest.raises(GenerationUnavailableError):
        build_generator(settings()).generate("Prazo?", [SOURCE], None)


@pytest.mark.parametrize("prefix,flag", [("SEM_EVIDENCIA:", "insufficient"), ("FORA_DO_ESCOPO:", "out_of_scope")])
def test_refusal_markers(monkeypatch, prefix, flag):
    install_response(monkeypatch, response(prefix + " Faltam dados."))
    result = build_generator(settings()).generate("Prazo?", [SOURCE], None)
    assert getattr(result, flag) and result.text == "Faltam dados."


@pytest.mark.parametrize("data", [
    {"promptFeedback": {"blockReason": "SAFETY"}},
    response("Texto parcial que não deve ser exibido.", "SAFETY"),
])
def test_safety_block_discards_content(monkeypatch, data):
    install_response(monkeypatch, data)
    result = build_generator(settings()).generate("Prazo?", [SOURCE], None)
    assert result.insufficient and not result.text and result.warnings


@pytest.mark.parametrize("data", [{}, [], {"candidates": "invalid"}])
def test_empty_or_invalid_responses_do_not_become_answers(monkeypatch, data):
    install_response(monkeypatch, data)
    with pytest.raises(GenerationUnavailableError):
        build_generator(settings()).generate("Prazo?", [SOURCE], None)


def test_thought_parts_are_not_shown_and_truncation_is_signaled(monkeypatch):
    data = response("Resposta [F1].", "MAX_TOKENS")
    data["candidates"][0]["content"]["parts"].insert(0, {"text": "internal reasoning", "thought": True})
    install_response(monkeypatch, data)
    result = build_generator(settings()).generate("Prazo?", [SOURCE], None)
    assert result.text == "Resposta [F1]." and result.warnings


def test_gemini_response_passes_through_api_and_citation_validation(indexed_client, monkeypatch):
    install_response(monkeypatch, response("A distância é de 1,5 metro [F1]."))
    indexed_client.app.state.container.pipeline.generator = build_generator(settings())
    result = indexed_client.post("/api/chat", json={"question": "Qual distância manter ao ultrapassar um ciclista?"}).json()
    assert result["status"] == "answered"
    assert result["generation"]["provider"] == "gemini" and result["generation"]["is_llm"]
    assert result["citations_valid"] and result["citations"][0]["source_id"]


def sequence(monkeypatch, statuses):
    calls, delays = [], []
    replies = iter(statuses)

    def post(url, **kwargs):
        calls.append((url, kwargs))
        status = next(replies)
        return httpx.Response(status, json=response() if status == 200 else {"error": {"status": "UNAVAILABLE"}})

    monkeypatch.setattr(generation.httpx, "post", post)
    monkeypatch.setattr(generation.time, "sleep", delays.append)
    return calls, delays


def test_transient_failure_retries_then_uses_same_model(monkeypatch):
    calls, delays = sequence(monkeypatch, [503, 200])
    generator = build_generator(settings(llm_max_retries=1))
    result = generator.generate("Prazo?", [SOURCE], None)
    assert len(calls) == 2 and calls[0][0] == calls[1][0]
    assert delays == [1] and result.model == generator.model
    assert not result.warnings


def test_overloaded_primary_uses_real_fallback_and_reports_actual_model(indexed_client, monkeypatch):
    calls, delays = sequence(monkeypatch, [503, 503, 200])
    generator = build_generator(settings(llm_max_retries=1, llm_fallback_models="gemini-3.5-flash-lite"))
    indexed_client.app.state.container.pipeline.generator = generator
    result = indexed_client.post("/api/chat", json={"question": "Qual distância manter ao ultrapassar um ciclista?"}).json()
    assert result["status"] == "answered" and result["citations_valid"]
    assert result["generation"]["model"] == "gemini-3.5-flash-lite" and result["generation"]["is_llm"]
    assert result["warnings"] and "gemini-3.5-flash-lite" in result["warnings"][0]
    assert "gemini-3.5-flash-lite:generateContent" in calls[-1][0]
    assert all(c[1]["json"] == calls[0][1]["json"] for c in calls)
    assert generator.model == "gemini-flash-latest"  # não altera estado compartilhado entre requisições
    assert delays == [1, 2]


@pytest.mark.parametrize("status", [400, 401, 403, 404, 429])
def test_permanent_errors_and_quota_do_not_retry_or_switch_model(monkeypatch, status):
    calls, delays = sequence(monkeypatch, [status])
    generator = build_generator(settings(llm_max_retries=2, llm_fallback_models="gemini-3.5-flash-lite"))
    with pytest.raises(GenerationUnavailableError):
        generator.generate("Prazo?", [SOURCE], None)
    assert len(calls) == 1 and not delays


def test_all_models_unavailable_stop_after_bounded_attempts(monkeypatch):
    calls, delays = sequence(monkeypatch, [503, 503, 503])
    generator = build_generator(settings(llm_max_retries=1, llm_fallback_models="gemini-3.5-flash-lite"))
    with pytest.raises(GenerationUnavailableError, match="HTTP 503"):
        generator.generate("Prazo?", [SOURCE], None)
    assert len(calls) == 3 and delays == [1, 2]


def test_recovery_respects_shared_deadline(monkeypatch):
    clock = [0.0]
    calls = []
    monkeypatch.setattr(generation.time, "perf_counter", lambda: clock[0])
    monkeypatch.setattr(generation.time, "sleep", lambda delay: clock.__setitem__(0, clock[0] + delay))

    def post(url, **kwargs):
        calls.append(kwargs["timeout"])
        clock[0] += kwargs["timeout"]
        raise httpx.ReadTimeout("private")

    monkeypatch.setattr(generation.httpx, "post", post)
    generator = build_generator(settings(llm_timeout_seconds=6, llm_max_retries=1,
                                         llm_fallback_models="gemini-3.5-flash-lite"))
    with pytest.raises(GenerationUnavailableError, match="tempo limite"):
        generator.generate("Prazo?", [SOURCE], None)
    assert len(calls) <= 3 and clock[0] <= 6
