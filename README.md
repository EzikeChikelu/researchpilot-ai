# ResearchPilot AI

ResearchPilot AI is a source-grounded research assistant that collects relevant web sources and can turn their excerpts into a structured, citation-aware Markdown research report.

## Current status

The FastAPI backend searches the web with Tavily, deduplicates source URLs, and optionally uses an OpenAI-compatible chat-completions API to synthesize the collected titles and excerpts. The Next.js interface displays the report and source list and supports copying or downloading the Markdown report. A same-origin Next.js route proxies browser requests to FastAPI, so the backend does not need to be publicly exposed for the normal web UI.

AI synthesis is optional: without an LLM key, the app still returns search results and clearly explains how to configure report generation. The model receives source titles, URLs, dates, and search excerpts—not the full source pages. Citation markers refer to the numbered collected source list and should be verified by opening the links.

The AI client retries temporary network failures and common transient provider responses (including HTTP 429 and 503) up to three attempts with bounded backoff. This improves resilience but does not bypass provider rate limits or guarantee availability.

## Architecture

- `apps/web`: Next.js + TypeScript frontend with a same-origin server-side API proxy
- `apps/api`: Python + FastAPI backend
- `apps/api/app/search.py`: Tavily search integration and URL deduplication
- `apps/api/app/synthesis.py`: OpenAI-compatible chat-completions integration with bounded transient-error retries
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

Create `apps/api/.env` and add your private keys. For Gemini, use a key from [Google AI Studio](https://aistudio.google.com/app/apikey):

```dotenv
TAVILY_API_KEY=your_tavily_api_key
LLM_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-3.5-flash-lite
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

The example Gemini model is configurable; available models, quotas, and free-tier terms can vary by account and may change. See Google's [OpenAI compatibility documentation](https://ai.google.dev/gemini-api/docs/openai) and [pricing](https://ai.google.dev/gemini-api/docs/pricing) before choosing a production model. Other providers that support the OpenAI chat-completions format can be configured with `LLM_MODEL` and `LLM_BASE_URL`.

Keep keys private and never commit your real `.env` file. Provider usage limits apply, and free-tier terms may differ from paid-tier terms.

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health).

Run API tests:

```bash
pytest -q
```

### Web

In a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `API_URL=http://127.0.0.1:8000` in `apps/web/.env.local` for Codespaces/local development. The Next.js server-side route at `/api/research` forwards requests to FastAPI, so the browser does not need direct access to port 8000 and CORS is not required for the normal UI flow. Keep the backend port Private when using this proxy. In production, configure `API_URL` to the backend's private/internal address. Never put private API keys in variables prefixed with `NEXT_PUBLIC_`.

## Research API

Send a request to `POST /api/v1/research`:

```json
{
  "question": "How does urban tree cover affect heat in cities?",
  "depth": "standard"
}
```

Supported depths: `quick`, `standard`, and `deep`. The response includes source metadata, `synthesis_status`, and `report_markdown` when synthesis succeeds. Missing search configuration returns HTTP 503; search-provider failures return HTTP 502. If AI synthesis is not configured or its provider fails, the API still returns collected sources with an explicit status rather than losing the research results.

## Production checklist

Before inviting public users:

1. Configure `TAVILY_API_KEY`, `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` as server-side secrets in the hosting platform.
2. Set `API_URL` to the backend's private/internal address and keep the backend port private when using the Next.js proxy.
3. Run API tests, web type-checking, and a production build.
4. Add rate limiting and request quotas at the edge or API gateway before exposing the research endpoint publicly; this repository does not currently implement per-user authentication or quotas.
5. Review provider terms, retention, privacy, and cost limits. Never promise unlimited free use.
6. Verify citations by opening the source URLs. The current synthesis uses search excerpts rather than full-page extraction, so important claims need independent verification.

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
