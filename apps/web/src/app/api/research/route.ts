import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const MIN_QUESTION_LENGTH = 12;
const MAX_QUESTION_LENGTH = 2000;
const VALID_DEPTHS = new Set(["quick", "standard", "deep"]);

function badRequest(detail: string) {
  return NextResponse.json({ detail }, { status: 400 });
}

export async function POST(request: Request) {
  // Fail closed in production if the private backend configuration is missing.
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.API_URL || !process.env.API_PROXY_TOKEN)
  ) {
    return NextResponse.json(
      { detail: "Research service is not configured correctly." },
      { status: 503 },
    );
  }

  const apiBase = (
    process.env.API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  let rawBody: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) {
      return badRequest("Request body is required.");
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json(
          { detail: "Request body is too large." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    rawBody = new TextDecoder().decode(bytes);
  } catch {
    return badRequest("Request body could not be read.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Request body must be a JSON object.");
  }

  const payload = body as { question?: unknown; depth?: unknown };
  if (typeof payload.question !== "string") {
    return badRequest("A research question is required.");
  }

  const question = payload.question.trim();
  if (question.length < MIN_QUESTION_LENGTH) {
    return badRequest("Please provide a more detailed research question.");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return badRequest(`Research questions must be ${MAX_QUESTION_LENGTH} characters or fewer.`);
  }

  const depth = payload.depth ?? "standard";
  if (typeof depth !== "string" || !VALID_DEPTHS.has(depth)) {
    return badRequest("Depth must be quick, standard, or deep.");
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    headers["X-API-Proxy-Token"] = process.env.API_PROXY_TOKEN || "";

    const upstream = await fetch(`${apiBase}/api/v1/research`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question, depth }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    const payloadText = await upstream.text();
    return new NextResponse(payloadText, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Research API is unreachable from the web server. Check API_URL and confirm the backend is running." },
      { status: 502 },
    );
  }
}
