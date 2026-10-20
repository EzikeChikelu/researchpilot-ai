# Deployment: Vercel + Render

This repository is a monorepo. Deploy the Next.js frontend to Vercel and the FastAPI backend to Render.

## 1. Deploy the API on Render

1. Sign in at https://render.com and connect the GitHub account that owns this repository.
2. Choose **New + → Blueprint** and select `EzikeChikelu/researchpilot-ai`. Render detects the root `render.yaml` file.
3. Review the `researchpilot-api` web service and create it. The Blueprint uses the free plan; free services can sleep when idle and may take a little while to wake up.
4. In the service's **Environment** page, set `TAVILY_API_KEY`, `LLM_API_KEY`, and `API_PROXY_TOKEN`. The first two are your provider keys. Generate a separate random token for `API_PROXY_TOKEN`; use the same token on Vercel. Do not commit or share these values.
5. Wait for deployment to finish. Open `https://YOUR-RENDER-SERVICE.onrender.com/api/v1/health`; it should return JSON with status `ok`. Save the service's HTTPS base URL.

## 2. Deploy the website on Vercel

1. Sign in at https://vercel.com using GitHub.
2. Choose **Add New → Project**, import `EzikeChikelu/researchpilot-ai`.
3. In project configuration, set **Root Directory** to `apps/web`. Keep the detected Next.js framework and default build settings.
4. Add these Environment Variables for **Production**:
   - `API_URL` = the Render service HTTPS base URL, with no trailing slash.
   - `API_PROXY_TOKEN` = the exact same random token you set in Render.
5. Click **Deploy** and wait for the build to finish. Open the generated `.vercel.app` URL and submit a small research question.

## 3. Secret handling

- Never use `NEXT_PUBLIC_` for API keys or the proxy token.
- Keep `TAVILY_API_KEY` and `LLM_API_KEY` only in Render's environment settings.
- The backend checks `X-API-Proxy-Token` on research requests when `API_PROXY_TOKEN` is configured. The health endpoint remains available for health checks.
- The API is still reachable at a public Render URL, but research calls require the shared token. Do not put that token in browser code.

## 4. Free-tier note

Render free web services can spin down after inactivity, so the first request may be slow. Check the current provider plans and limits before sharing the app widely. Add user authentication, rate limiting, and usage quotas before operating it as a public service.

## 5. Troubleshooting

- Render build failure: open the service's **Events/Logs** and check the Python dependency installation output.
- Health endpoint fails: inspect Render logs and verify the service start command.
- Vercel returns a 502: check that `API_URL` is the Render HTTPS base URL and that both `API_PROXY_TOKEN` values match exactly.
- Research returns 401: re-enter the same `API_PROXY_TOKEN` in both services, save, and redeploy.
- Research returns 503 from search: verify `TAVILY_API_KEY` in Render.
- AI synthesis fails while sources appear: verify `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` in Render. Provider model availability and quotas can change.
