import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const MIN_QUESTION_LENGTH = 12;
const MAX_QUESTION_LENGTH = 2000;
const VALID_DEPTHS = new Set(["quick", "standard", "deep"]);
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 10 * 60;

// A single atomic Redis operation avoids per-instance in-memory limits on serverless.
const RATE_LIMIT_SCRIPT = [
  'local count = redis.call("INCR", KEYS[1])',
  'if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end',
  'local ttl = redis.call("TTL", KEYS[1])',
  'return {count, ttl}',
].join("\n");

function badRequest(detail: string) {
  return NextResponse.json({ detail }, { status: 400 });
}

async function enforceRateLimit(request: Request) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Keep existing deployments working until the Redis credentials are configured.
  // Production checklist explicitly requires enabling this before public launch.
  if (!redisUrl && !redisToken) return null;

  if (!redisUrl || !redisToken) {
    return NextResponse.json(
      { detail: "Research rate limiting is not configured correctly." },
      { status: 503 },
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const key = `researchpilot:rate-limit:${ipHash}`;

  try {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        RATE_LIMIT_SCRIPT,
        1,
        key,
        RATE_WINDOW_SECONDS,
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) throw new Error("Rate-limit store returned an error");
    const result = (await response.json()) as {
      result?: [number, number];
      error?: string;
    };
    if (result.error || !Array.isArray(result.result)) {
      throw new Error("Invalid rate-limit store response");
    }

    const [count, ttl] = result.result;
    if (count > RATE_LIMIT) {
      return NextResponse.json(
        { detail: "Too many research requests. Please wait before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, ttl)),
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return null;
  } catch {
    // Fail closed when rate limiting has been configured but its store is unavailable.
    return NextResponse.json(
      { detail: "Research is temporarily unavailable because request protection could not be verified. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
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

  const rateLimitResponse = await enforceRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

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
