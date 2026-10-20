# ResearchPilot AI

ResearchPilot AI is a source-grounded research assistant that collects relevant web sources and can turn their excerpts into a structured, citation-aware Markdown research report.

## Current status

**Milestone 3 — source-grounded AI synthesis.** The FastAPI backend searches the web with Tavily, deduplicates source URLs, and optionally asks an OpenAI-compatible chat-completions API to synthesize the collected titles and excerpts. The Next.js interface displays the report and source list and supports copying or downloading the Markdown report.

AI synthesis is optional: without an LLM key, the app still returns search results and clearly explains how to configure report generation. The model receives source titles, URLs, dates, and search excerpts—not the full source pages. Citation markers refer to the numbered collected source list and should be verified by opening the links.

## Architecture

- `apps/web`: Next.js + TypeScript frontend
- `apps/api`: Python + FastAPI backend
- `apps/api/app/search.py`: Tavily search integration and URL deduplication
- `apps/api/app/synthesis.py`: OpenAI-compatible chat-completions integration for report synthesis
- `apps/api/tests`: API behavior tests

## Prerequisites

- Node.js 20+
- Python 3.11+
- npm
- A Tavily API key for live web search
- Optional LLM provider API key for AI synthesis

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

Create `apps/api/.env` and add your private keys:

```dotenv
TAVILY_API_KEY=your_tavily_api_key
LLM_API_KEY=your_model_provider_api_key
# Optional; defaults shown:
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=https://api.openai.com/v1
```

Get a search key from [Tavily](https://tavily.com/). For AI synthesis, use an API key from a provider compatible with the OpenAI chat-completions format. Provider usage may incur charges. Keep keys private and never commit your real `.env` file.

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `apps/web/.env.local` for local development. For forwarded environments, use the backend's reachable URL. Never put private API keys in variables prefixed with `NEXT_PUBLIC_`.

## Research API

Send a request to `POST /api/v1/research`:

```json
{
  "question": "How does urban tree cover affect heat in cities?",
  "depth": "standard"
}
```

Supported depths: `quick`, `standard`, and `deep`. The response includes source metadata, `synthesis_status`, and `report_markdown` when synthesis succeeds. Missing search configuration returns HTTP 503; search-provider failures return HTTP 502. If AI synthesis is not configured or its provider fails, the API still returns collected sources with an explicit status rather than losing the research results.

## Environment variables

See `.env.example`. Keep secrets server-side and do not commit local `.env` files.

## Roadmap

1. Project foundation and health checks
2. Real web search, source normalization and deduplication
3. AI research synthesis with source-linked citation markers
4. Report workspace, progress states and Markdown export
5. Source extraction, citation validation, persistence, PDF export and account features
6. Deployment, CI hardening and portfolio documentation

## Product principles

- Citations must point to collected sources.
- Source links and AI-generated interpretation must be clearly distinguished.
- Search and model-provider failures should be visible and recoverable.
- Do not claim a research run completed unless it actually completed.
- The current synthesis uses search excerpts, not full-page extraction; verify important claims against original sources.
