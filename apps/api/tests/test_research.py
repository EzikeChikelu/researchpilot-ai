from fastapi.testclient import TestClient

from app import main
from app.search import SearchConfigurationError, SearchProviderError

client = TestClient(main.app)


def test_research_returns_deduplicated_sources(monkeypatch) -> None:
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

    monkeypatch.setattr(main, "search_web", fake_search)
    response = client.post(
        "/api/v1/research",
        json={"question": "How does urban tree cover affect city heat?", "depth": "quick"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "sources_found"
    assert payload["synthesis_status"] == "not_implemented"
    assert len(payload["sources"]) == 1
    assert payload["sources"][0]["title"] == "Urban Trees"


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
