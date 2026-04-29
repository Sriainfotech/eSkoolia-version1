const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

function buildHeaders(req: Request, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function proxyRequest(
  req: Request,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  const hasBody = init?.body !== undefined;
  return fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    method: init?.method || req.method,
    headers: buildHeaders(req, hasBody),
    body: hasBody ? JSON.stringify(init?.body) : undefined,
    cache: "no-store",
  });
}

export function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: T[] }).results;
  }
  return [];
}

export function toApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.message === "string" && p.message.trim()) return p.message;
    if (typeof p.detail === "string" && p.detail.trim()) return p.detail;
    if (typeof p.error === "string" && p.error.trim()) return p.error;
    if (p.error && typeof p.error === "object") {
      const e = p.error as Record<string, unknown>;
      if (typeof e.message === "string" && e.message.trim()) return e.message;
    }
  }
  return fallback;
}

export async function forwardError(response: Response, fallback: string): Promise<Response> {
  const payload = await parseJsonSafe(response);
  return Response.json(
    { error: toApiError(payload, fallback) },
    { status: response.status || 500 }
  );
}

export async function readJson(response: Response): Promise<unknown> {
  return parseJsonSafe(response);
}
