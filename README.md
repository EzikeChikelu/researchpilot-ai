# ResearchPilot AI

ResearchPilot AI is a source-grounded research assistant that collects relevant web sources for a question and is being developed toward structured reports with verifiable citations.

## Current status

**Milestone 2 — live web source collection.** The FastAPI backend now exposes `POST /api/v1/research`, uses Tavily for web search, removes duplicate source URLs, and returns clickable source metadata. The Next.js interface displays the results.

**AI planning and synthesis are not implemented yet.** The current milestone gathers sources only; it does not claim to have generated a completed research report.

## Architecture

- `apps/web`: Next.js + TypeScript frontend
- `apps/api`: Python + FastAPI backend
- `apps/api/app/search.py`: isolated Tavily search integration and URL deduplication
- Tests and GitHub Actions provide repeatable quality checks.

## Prerequisites

- Node.js 20+
- Python 3.11+
- npm
- A Tavily API key for live web search

## Run locally

### API

```bash
cd apps/api
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
```

Create `apps/api/.env` and add your private search key:

```dotenv
TAVILY_API_KEY=your_tavily_api_key
```

Get a key from [Tavily](https://tavily.com/). The API reads environment variables from the process, so load the key into your shell before starting the server, or use a local environment loader. Do not commit real secrets.

Start the API:

```bash
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

## Research API

Send a request to `POST /api/v1/research`:

```json
{
  "question": "How does urban tree cover affect heat in cities?",
  "depth": "standard"
}
```

Supported depths: `quick`, `standard`, and `deep`. The response contains normalized source records, a source count, and an explicit `synthesis_status` of `not_implemented` until AI synthesis is built. Missing search configuration returns HTTP 503; provider failures return HTTP 502.

## Environment variables

See the root `.env.example`. Keep secrets server-side and do not commit local `.env` files.

## Roadmap

1. Project foundation and health checks
2. Real web search, source normalization and deduplication
3. AI research planning, synthesis and citation validation
4. Report workspace, progress states and Markdown export
5. Persistence, PDF export and account features
6. Deployment, CI hardening and portfolio documentation

## Product principles

- Citations must point to collected sources.
- Source links and AI-generated interpretation must be clearly distinguished.
- Provider failures should be visible and recoverable.
- Do not claim a research run completed unless it actually completed.
