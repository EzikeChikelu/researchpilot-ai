from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import ResearchRequest
from app.search import SearchConfigurationError, SearchProviderError, search_web

app = FastAPI(
    title="ResearchPilot AI API",
    description="API for source-grounded AI research reports.",
    version="0.2.0",
)

# Local development defaults. Production origins should be explicitly configured.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/api/v1/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Return a lightweight health status for local development and deployment checks."""
    return {"status": "ok", "service": "researchpilot-api"}


@app.post("/api/v1/research", tags=["research"])
def research(request: ResearchRequest) -> dict:
    """Collect source links for a question; synthesis is a separate future milestone."""
    try:
        sources = search_web(request.question, request.depth)
    except SearchConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SearchProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "status": "sources_found",
        "question": request.question,
        "depth": request.depth,
        "source_count": len(sources),
        "sources": sources,
        "synthesis_status": "not_implemented",
        "message": "Sources collected successfully. AI synthesis is the next milestone.",
    }
