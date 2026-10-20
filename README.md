# ResearchPilot AI

ResearchPilot AI is a source-grounded research assistant that turns a question into a structured report with verifiable source links.

## Current status

**Milestone 1 — project foundation.** The repository contains a Next.js web app and a FastAPI backend health endpoint. Live web search and AI synthesis are planned next; they are not implemented yet.

## Architecture

- `apps/web`: Next.js + TypeScript frontend
- `apps/api`: Python + FastAPI backend
- Search and language-model integrations will be isolated behind service interfaces.
- Tests and GitHub Actions provide repeatable quality checks.

## Prerequisites

- Node.js 20+
- Python 3.11+
- npm

## Run locally

### API

```bash
cd apps/api
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health).

Run API tests:

```bash
pytest
```

### Web

In a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `apps/web/.env.local` if you want the UI to call the local API. Never put private API keys in variables prefixed with `NEXT_PUBLIC_`.

## Environment variables

See the root `.env.example`. Do not commit real secrets.

## Roadmap

1. Project foundation and health checks
2. Real web search and source normalization
3. AI research planning, synthesis and citation validation
4. Report workspace, progress states and Markdown export
5. Persistence, PDF export and account features
6. Deployment, CI hardening and portfolio documentation

## Product principles

- Citations must point to collected sources.
- Source links and AI-generated interpretation must be clearly distinguished.
- Provider failures should be visible and recoverable.
- Do not claim a research run completed unless it actually completed.
