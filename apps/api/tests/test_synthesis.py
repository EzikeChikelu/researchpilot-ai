from __future__ import annotations

import httpx
import pytest

from app import synthesis
from app.synthesis import SynthesisProviderError, synthesize_report


SOURCE = [
    {
        "title": "Urban Trees",
        "url": "https://example.com/trees",
        "snippet": "Trees can provide shade.",
        "published_date": None,
    }
]


def _response(status: int, payload: dict, *, headers: dict | None = None) -> httpx.Response:
    return httpx.Response(
        status,
        json=payload,
        headers=headers,
        request=httpx.Request("POST", "https://provider.example/chat/completions"),
    )


class FakeClient:
    def __init__(self, responses: list[httpx.Response]) -> None:
        self.responses = responses
        self.calls = 0

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def post(self, *args: object, **kwargs: object) -> httpx.Response:
        response = self.responses[self.calls]
        self.calls += 1
        return response


def test_synthesis_retries_temporary_503_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_BASE_URL", "https://provider.example/v1")
    client = FakeClient(
        [
            _response(503, {"error": {"message": "Busy"}}),
            _response(
                200,
                {"choices": [{"message": {"content": "## Findings\nTrees provide shade [1]."}}]},
            ),
        ]
    )
    sleeps: list[float] = []
    monkeypatch.setattr(synthesis.httpx, "Client", lambda **kwargs: client)
    monkeypatch.setattr(synthesis.time, "sleep", sleeps.append)

    report = synthesize_report("How does urban tree cover affect city heat?", SOURCE)

    assert report == "## Findings\nTrees provide shade [1]."
    assert client.calls == 2
    assert sleeps == [1]


def test_synthesis_honors_numeric_retry_after(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    client = FakeClient(
        [
            _response(429, {"error": {"message": "Busy"}}, headers={"Retry-After": "3"}),
            _response(200, {"choices": [{"message": {"content": "Done."}}]}),
        ]
    )
    sleeps: list[float] = []
    monkeypatch.setattr(synthesis.httpx, "Client", lambda **kwargs: client)
    monkeypatch.setattr(synthesis.time, "sleep", sleeps.append)

    assert synthesize_report("How does urban tree cover affect city heat?", SOURCE) == "Done."
    assert sleeps == [3]


def test_synthesis_fails_cleanly_after_retryable_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    client = FakeClient([_response(503, {"error": "busy"}) for _ in range(3)])
    monkeypatch.setattr(synthesis.httpx, "Client", lambda **kwargs: client)
    monkeypatch.setattr(synthesis.time, "sleep", lambda _seconds: None)

    with pytest.raises(SynthesisProviderError, match="provider could not complete"):
        synthesize_report("How does urban tree cover affect city heat?", SOURCE)

    assert client.calls == 3



def test_synthesis_prompt_requires_evidence_quality_and_uncertainty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")

    class PromptInspectingClient(FakeClient):
        request_body: dict | None = None

        def post(self, *args: object, **kwargs: object) -> httpx.Response:
            self.request_body = kwargs.get("json")
            return _response(
                200,
                {"choices": [{"message": {"content": "## Executive summary\\nEvidence is limited [1]."}}]},
            )

    client = PromptInspectingClient([])
    monkeypatch.setattr(synthesis.httpx, "Client", lambda **kwargs: client)

    report = synthesize_report("What does the evidence show?", SOURCE)

    assert "Executive summary" in report
    assert client.request_body is not None
    system_prompt = client.request_body["messages"][0]["content"]
    assert "Evidence quality and disagreements" in system_prompt
    assert "Open questions or what remains uncertain" in system_prompt
    assert "Do not present qualitative labels as statistical certainty" in system_prompt
    assert "Never invent a source" in system_prompt
    assert "clean, conventional Markdown only" in system_prompt
    assert "Do not use Markdown tables, horizontal rules, decorative separators" in system_prompt
