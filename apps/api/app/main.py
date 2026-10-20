from __future__ import annotations

import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import ResearchRequest
from app.search import SearchConfigurationError, SearchProviderError, search_web
from app.synthesis import (
    SynthesisConfigurationError,
    SynthesisProviderError,
    synthesize_report,
)

app = FastAPI(
    title="ResearchPilot AI API",
    description="API for source-grounded AI research reports.",
    version="0.3.0",
)

# Add the exact Codespaces frontend origin when using a forwarded port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://laughing-space-barnacle-9vrrvv9qvrg3g5p-3000.app.github.dev",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-API-Proxy-Token"],
)


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Return a lightweight health status for local development and deployment checks."""
    return {"status": "ok", "service": "researchpilot-api"}


@app.post("/api/v1/research", tags=["research"])
def research(
    request: ResearchRequest,
    x_api_proxy_token: str | None = Header(default=None, alias="X-API-Proxy-Token"),
) -> dict:
    """Collect web sources and synthesize a cited report when an LLM is configured."""
    # Configure API_PROXY_TOKEN in production on both services. Local development
    # remains convenient when the variable is not set.
    expected_token = os.getenv("API_PROXY_TOKEN")
    if expected_token and not hmac.compare_digest(x_api_proxy_token or "", expected_token):
        raise HTTPException(status_code=401, detail="Unauthorized API proxy request.")

    try:
        sources = search_web(request.question, request.depth)
    except SearchConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SearchProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    report_markdown = None
    synthesis_status = "completed"
    synthesis_message = "Research report generated from collected source excerpts."
    try:
        report_markdown = synthesize_report(request.question, sources)
    except SynthesisConfigurationError as exc:
        synthesis_status = "not_configured"
        synthesis_message = str(exc)
    except SynthesisProviderError as exc:
        synthesis_status = "failed"
        synthesis_message = str(exc)

    return {
        "status": "sources_found",
        "question": request.question,
        "depth": request.depth,
        "source_count": len(sources),
        "sources": sources,
        "synthesis_status": synthesis_status,
        "report_markdown": report_markdown,
        "message": synthesis_message,
    }
