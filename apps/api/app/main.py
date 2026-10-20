from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="ResearchPilot AI API",
    description="API for source-grounded AI research reports.",
    version="0.1.0",
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
