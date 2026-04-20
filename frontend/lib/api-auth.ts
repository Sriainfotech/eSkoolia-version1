import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth";

const GENERIC_ERROR_MESSAGES = new Set([
  "invalid",
  "error",
  "validation failed",
  "bad request",
  "request failed",
  "an unexpected error occurred",
  "something went wrong",
]);

function cleanMessage(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (GENERIC_ERROR_MESSAGES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

function firstErrorMessage(value: unknown): string | null {
  if (typeof value === "string") {
    return cleanMessage(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item);
      if (message) {
        return message;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const message = firstErrorMessage(record[key]);
      if (message) {
        return message;
      }
    }
  }

  return null;
}

function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractFieldMessage(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const payload = details as Record<string, unknown>;
  for (const [field, value] of Object.entries(payload)) {
    const message = firstErrorMessage(value);
    if (!message) {
      continue;
    }
    if (field === "non_field_errors") {
      return message;
    }
    return `${formatFieldName(field)} ${message}`;
  }

  return null;
}

function extractApiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const payload = body as Record<string, unknown>;

    const fromErrors = extractFieldMessage(payload.errors);
    if (fromErrors) {
      return fromErrors;
    }

    const fromErrorDetails = extractFieldMessage((payload.error as Record<string, unknown> | undefined)?.details);
    if (fromErrorDetails) {
      return fromErrorDetails;
    }

    const fromErrorMessage = firstErrorMessage((payload.error as Record<string, unknown> | undefined)?.message);
    if (fromErrorMessage) {
      return fromErrorMessage;
    }

    const fromMessage = firstErrorMessage(payload.message);
    if (fromMessage) {
      return fromMessage;
    }

    const fromDetail = firstErrorMessage(payload.detail);
    if (fromDetail) {
      return fromDetail;
    }

    const fromNonField = firstErrorMessage(payload.non_field_errors);
    if (fromNonField) {
      return fromNonField;
    }

    const fromDetails = extractFieldMessage(payload.details);
    if (fromDetails) {
      return fromDetails;
    }

    const fromAnyField = firstErrorMessage(payload);
    if (fromAnyField) {
      return fromAnyField;
    }
  }

  return `Request failed with status ${status}`;
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isNetworkLike = message.includes("fetch") || message.includes("network") || message.includes("failed");
    if (!isNetworkLike) {
      throw error;
    }

    // Retry once for transient browser/network failures (e.g., interrupted upload request).
    return fetch(input, init);
  }
}

async function requestWithRefreshResponse(path: string, options?: RequestInit): Promise<Response> {
  let token = getAccessToken();
  if (!token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("401");
    token = refreshed;
  }

  let response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...options,
    headers:
      options?.body instanceof FormData
        ? withAuthHeaders(token, options?.headers)
        : withAuthHeaders(token, {
            "Content-Type": "application/json",
            ...(options?.headers as Record<string, string> | undefined),
          }),
    cache: options?.cache ?? "no-store",
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("401");

    response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
      ...options,
      headers:
        options?.body instanceof FormData
          ? withAuthHeaders(refreshed, options?.headers)
          : withAuthHeaders(refreshed, {
              "Content-Type": "application/json",
              ...(options?.headers as Record<string, string> | undefined),
            }),
      cache: options?.cache ?? "no-store",
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearAuthTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const apiError = new Error(extractApiErrorMessage(body, response.status)) as Error & {
      details?: unknown;
      status?: number;
    };
    apiError.details = body;
    apiError.status = response.status;
    throw apiError;
  }

  return response;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetchWithRetry(`${API_BASE_URL}/api/v1/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    clearAuthTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  const data = (await res.json()) as { access?: string };
  if (!data.access) {
    clearAuthTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  setAuthTokens(data.access, refresh);
  return data.access;
}

function withAuthHeaders(token: string, headers?: HeadersInit): HeadersInit {
  const base: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    return { ...base, ...(headers as Record<string, string>) };
  }
  return base;
}

function toNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeIdsDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeIdsDeep(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    normalized[key] = normalizeIdsDeep(item);
  }

  const currentId = toNumericId(normalized.id);
  if (currentId !== null) {
    normalized.id = currentId;
    return normalized;
  }

  const pkId = toNumericId(normalized.pk);
  if (pkId !== null) {
    normalized.id = pkId;
    return normalized;
  }

  const idLikeKeys = Object.keys(normalized).filter((key) => key.endsWith("_id") && toNumericId(normalized[key]) !== null);
  if (idLikeKeys.length === 1) {
    const key = idLikeKeys[0];
    const fallbackId = toNumericId(normalized[key]);
    if (fallbackId !== null) {
      normalized.id = fallbackId;
    }
  }

  return normalized;
}

export async function apiRequestWithRefresh<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await requestWithRefreshResponse(path, options);

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  const parsed = JSON.parse(text) as unknown;
  return normalizeIdsDeep(parsed) as T;
}

export async function apiRequestWithRefreshResponse(path: string, options?: RequestInit): Promise<Response> {
  return requestWithRefreshResponse(path, options);
}
