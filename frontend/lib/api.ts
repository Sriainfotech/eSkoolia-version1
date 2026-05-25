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
  // Subdomain-based multi-tenant access: use same hostname on port 8000
  // so the backend tenant middleware can resolve the tenant from the Host header.
  // e.g. testschool.eskoolia.local:3000 → http://testschool.eskoolia.local:8000
  if (hostname !== "127.0.0.1") {
    // Production (*.eskoolia.com): API is behind Nginx on standard ports — no explicit port needed.
    // Local dev (*.eskoolia.local or similar): Django runs directly on port 8000.
    if (hostname.endsWith(".eskoolia.com") || hostname === "eskoolia.com") {
      return `${protocol}//${hostname}`;
    }
    return `${protocol}//${hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

const DEFAULT_API_BASE_URL = deriveApiBaseUrl();

// On the dev tunnel OR a tenant subdomain, ignore the localhost env var so the
// browser hits the correct host and the backend tenant middleware sees the subdomain.
function pickApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const onTunnel = /devtunnels\.ms$/i.test(host) || /\.githubpreview\.dev$/i.test(host);
    if (onTunnel) return DEFAULT_API_BASE_URL;
    // Tenant subdomain (e.g. testschool.eskoolia.local): use derived URL so the
    // Host header carries the subdomain to the backend tenant middleware.
    const parts = host.split(".");
    if (parts.length >= 3 && parts[1] === "eskoolia") return DEFAULT_API_BASE_URL;
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
