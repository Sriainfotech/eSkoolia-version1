"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access: string;
  refresh: string;
  must_change_password: boolean;
  school_code?: string | null;   // e.g. "springdale" — null for super-admin
  tenant_id?: string | null;     // e.g. "SCH-001"    — null for super-admin
  is_super_admin?: boolean;
}

export interface MeResponse {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  must_change_password: boolean;
  is_superuser: boolean;
  is_school_admin?: boolean;
  role_names?: string[];
  permission_codes?: string[];
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function extractError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const p = body as Record<string, unknown>;
    for (const key of ["message", "detail", "error", "non_field_errors"]) {
      const v = p[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (Array.isArray(v) && typeof v[0] === "string" && v[0]) return v[0] as string;
      // Handle nested error object: { "error": { "message": "..." } }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const nested = (v as Record<string, unknown>).message;
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
  }
  // Friendly fallbacks by HTTP status code
  const fallbacks: Record<number, string> = {
    400: "Invalid request. Please check your input.",
    401: "Invalid credentials. Please try again.",
    403: "You don't have permission to perform this action.",
    404: "The requested resource was not found.",
    409: "A record with this information already exists.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "Server error. Please try again later.",
    502: "Server is temporarily unavailable. Please try again.",
    503: "Service unavailable. Please try again in a moment.",
  };
  return fallbacks[status] ?? "Something went wrong. Please try again.";
}

async function authFetch(
  path: string,
  options?: RequestInit,
  token?: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore parse error
    }
    throw new Error(extractError(body, res.status));
  }
  return res;
}

// ─── Public API helpers ────────────────────────────────────────────────────────

export async function apiLogin(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await authFetch("/api/v1/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return res.json() as Promise<LoginResponse>;
}

export async function apiGetMe(): Promise<MeResponse> {
  const token = getAccessToken();
  const res = await authFetch("/api/v1/auth/me/", { method: "GET" }, token);
  return res.json() as Promise<MeResponse>;
}

export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  const token = getAccessToken();
  await authFetch(
    "/api/v1/auth/change-password/",
    { method: "POST", body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) },
    token,
  );
}

/** Sends a 6-digit OTP to the registered email address. */
export async function apiForgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new Error(extractError(body, res.status));
  }
}

/** Checks the 6-digit OTP is valid without consuming it. */
export async function apiVerifyResetCode(email: string, code: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-reset-code/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new Error(extractError(body, res.status));
  }
}

/** Validates the OTP and sets the new password. */
export async function apiResetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new Error(extractError(body, res.status));
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from stored tokens on mount.
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiGetMe()
      .then((me) => setUser(me))
      .catch(() => clearAuthTokens())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResponse> => {
      const result = await apiLogin(username, password);
      setAuthTokens(result.access, result.refresh);
      // Persist tenant context so any component can read the active school.
      if (result.school_code) {
        sessionStorage.setItem("school_code", result.school_code);
        sessionStorage.setItem("tenant_id", result.tenant_id ?? "");
      } else {
        sessionStorage.removeItem("school_code");
        sessionStorage.removeItem("tenant_id");
      }
      const me = await apiGetMe();
      setUser(me);
      return result;
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        const token = getAccessToken();
        await authFetch(
          "/api/v1/auth/logout/",
          { method: "POST", body: JSON.stringify({ refresh }) },
          token,
        );
      }
    } catch {
      // Always clear local tokens even if the server call fails.
    }
    clearAuthTokens();
    sessionStorage.removeItem("school_code");
    sessionStorage.removeItem("tenant_id");
    setUser(null);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiChangePassword(oldPassword, newPassword);
    const me = await apiGetMe();
    setUser(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      changePassword,
    }),
    [user, isLoading, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>.");
  return ctx;
}
