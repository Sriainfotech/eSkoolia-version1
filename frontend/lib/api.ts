function deriveApiBaseUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  const { hostname, protocol } = window.location;
  // VS Code / GitHub dev tunnels: replace "-3000." with "-8000." in hostname.
  // e.g. https://39k3c0bf-3000.inc1.devtunnels.ms  ->  https://39k3c0bf-8000.inc1.devtunnels.ms
  if (/devtunnels\.ms$/i.test(hostname) || /\.githubpreview\.dev$/i.test(hostname)) {
    const apiHost = hostname.replace(/-3000\./, "-8000.");
    return `${protocol}//${apiHost}`;
  }
  if (hostname === "localhost") return "http://localhost:8000";
  return "http://127.0.0.1:8000";
}

const DEFAULT_API_BASE_URL = deriveApiBaseUrl();

// On the dev tunnel, ignore the localhost env var (set for local dev) so the
// browser hits the public tunnel URL instead of unreachable 127.0.0.1:8000.
function pickApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const onTunnel = /devtunnels\.ms$/i.test(host) || /\.githubpreview\.dev$/i.test(host);
    if (onTunnel) return DEFAULT_API_BASE_URL;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = pickApiBaseUrl();

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
