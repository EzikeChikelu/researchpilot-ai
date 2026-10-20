from fastapi.testclient import TestClient

from app import main
from app.search import SearchConfigurationError, SearchProviderError
from app.synthesis import SynthesisConfigurationError, SynthesisProviderError

client = TestClient(main.app)


def test_research_returns_sources_and_synthesized_report(monkeypatch) -> None:
    def fake_search(question: str, depth: str) -> list[dict]:
        assert question == "How does urban tree cover affect city heat?"
        assert depth == "quick"
        return [
            {
                "title": "Urban Trees",
                "url": "https://example.com/trees#overview",
                "snippet": "Trees can provide shade.",
                "score": 0.91,
                "published_date": None,
            }
        ]

    def fake_synthesis(question: str, sources: list[dict]) -> str:
        assert question == "How does urban tree cover affect city heat?"
        assert sources[0]["title"] == "Urban Trees"
        return "## Findings\nTrees provide shade [1]."

    monkeypatch.setattr(main, "search_web", fake_search)
    monkeypatch.setattr(main, "synthesize_report", fake_synthesis)
    response = client.post(
        "/api/v1/research",
        json={"question": "How does urban tree cover affect city heat?", "depth": "quick"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "sources_found"
    assert payload["synthesis_status"] == "completed"
    assert payload["report_markdown"] == "## Findings\nTrees provide shade [1]."
    assert len(payload["sources"]) == 1
    assert payload["sources"][0]["title"] == "Urban Trees"


def test_research_returns_sources_when_synthesis_is_not_configured(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "search_web",
        lambda question, depth: [
            {"title": "Urban Trees", "url": "https://example.com/trees", "snippet": "Shade.", "score": None, "published_date": None}
        ],
    )

    def missing_synthesis(question: str, sources: list[dict]) -> str:
        raise SynthesisConfigurationError("Add LLM_API_KEY to apps/api/.env.")

    monkeypatch.setattr(main, "synthesize_report", missing_synthesis)
    response = client.post(
        "/api/v1/research",
        json={"question": "How does urban tree cover affect city heat?"},
    )

    assert response.status_code == 200
    assert response.json()["synthesis_status"] == "not_configured"
    assert response.json()["report_markdown"] is None
    assert len(response.json()["sources"]) == 1


def test_research_reports_missing_search_configuration(monkeypatch) -> None:
    def missing_configuration(question: str, depth: str) -> list[dict]:
        raise SearchConfigurationError("Add TAVILY_API_KEY to apps/api/.env and restart the API.")

    monkeypatch.setattr(main, "search_web", missing_configuration)
    response = client.post(
        "/api/v1/research",
        json={"question": "How does urban tree cover affect city heat?"},
    )

    assert response.status_code == 503
    assert "TAVILY_API_KEY" in response.json()["detail"]


def test_research_reports_search_provider_failure(monkeypatch) -> None:
    def provider_failure(question: str, depth: str) -> list[dict]:
        raise SearchProviderError("The web search provider could not complete the request.")

    monkeypatch.setattr(main, "search_web", provider_failure)
    response = client.post(
        "/api/v1/research",
        json={"question": "How does urban tree cover affect city heat?"},
    )

    assert response.status_code == 502
    assert "provider" in response.json()["detail"]


def test_research_keeps_sources_when_synthesis_provider_fails(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "search_web",
        lambda question, depth: [
            {"title": "Urban Trees", "url": "https://example.com/trees", "snippet": "Shade.", "score": None, "published_date": None}
        ],
    )

    def failed_synthesis(question: str, sources: list[dict]) -> str:
        raise SynthesisProviderError("AI provider unavailable.")

    monkeypatch.setattr(main, "synthesize_report", failed_synthesis)
    response = client.post(
        "/api/v1/research",
        json={"question": "How does urban tree cover affect city heat?"},
    )

    assert response.status_code == 200
    assert response.json()["synthesis_status"] == "failed"
    assert response.json()["report_markdown"] is None
    assert len(response.json()["sources"]) == 1
