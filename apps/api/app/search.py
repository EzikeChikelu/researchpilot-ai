"""Provider-isolated web search integration for ResearchPilot AI."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import urldefrag, urlsplit, urlunsplit

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class SearchConfigurationError(RuntimeError):
    """Raised when the web search provider has not been configured."""


class SearchProviderError(RuntimeError):
    """Raised when the upstream search provider cannot return results."""


DEPTH_SETTINGS = {
    "quick": {"search_depth": "basic", "max_results": 5},
    "standard": {"search_depth": "advanced", "max_results": 8},
    "deep": {"search_depth": "advanced", "max_results": 12},
}


def normalize_url(url: str) -> str:
    """Remove URL fragments and trailing slashes for reliable deduplication."""
    without_fragment, _fragment = urldefrag(url.strip())
    parts = urlsplit(without_fragment)
    normalized_path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), normalized_path, parts.query, ""))


def search_web(question: str, depth: str) -> list[dict[str, Any]]:
    """Search the web with Tavily and return deduplicated, linkable source records."""
    api_key = os.getenv("TAVILY_API_KEY") or os.getenv("SEARCH_API_KEY")
    if not api_key:
        raise SearchConfigurationError(
            "Web search is not configured. Add TAVILY_API_KEY to apps/api/.env and restart the API."
        )

    settings = DEPTH_SETTINGS[depth]
    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": question,
                    "search_depth": settings["search_depth"],
                    "max_results": settings["max_results"],
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SearchProviderError("The web search provider could not complete the request.") from exc

    results = payload.get("results")
    if not isinstance(results, list):
        raise SearchProviderError("The web search provider returned an unexpected response.")

    sources: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in results:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        title = item.get("title")
        if not isinstance(url, str) or not isinstance(title, str) or not url.startswith(("https://", "http://")):
            continue
        normalized = normalize_url(url)
        if normalized in seen_urls:
            continue
        seen_urls.add(normalized)
        sources.append(
            {
                "title": title,
                "url": url,
                "snippet": item.get("content") if isinstance(item.get("content"), str) else "",
                "score": item.get("score") if isinstance(item.get("score"), (int, float)) else None,
                "published_date": item.get("published_date") if isinstance(item.get("published_date"), str) else None,
            }
        )
    return sources
