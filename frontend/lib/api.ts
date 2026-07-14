// Configurable backend port — set NEXT_PUBLIC_BACKEND_PORT in .env to override default 8000.
// e.g. NEXT_PUBLIC_BACKEND_PORT=8765 when Django runs on a non-default port locally.
const DEV_BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || "8000";

function deriveApiBaseUrl(): string {
  if (typeof window === "undefined") return `http://127.0.0.1:${DEV_BACKEND_PORT}`;
  const { hostname, protocol } = window.location;
  // VS Code / GitHub dev tunnels: replace "-3000." with "-<port>." in hostname.
  if (/devtunnels\.ms$/i.test(hostname) || /\.githubpreview\.dev$/i.test(hostname)) {
    const apiHost = hostname.replace(/-3000\./, `-${DEV_BACKEND_PORT}.`);
    return `${protocol}//${apiHost}`;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") return `http://127.0.0.1:${DEV_BACKEND_PORT}`;
  // Subdomain-based multi-tenant access: use same hostname on the backend port
  // so the backend tenant middleware can resolve the tenant from the Host header.
  // e.g. testschool.eskoolia.local:3000 → http://testschool.eskoolia.local:<port>
  if (hostname !== "127.0.0.1") {
    // Production (*.eskoolia.com): API is behind Nginx on standard ports — no explicit port needed.
    if (hostname.endsWith(".eskoolia.com") || hostname === "eskoolia.com") {
      return `${protocol}//${hostname}`;
    }
    return `${protocol}//${hostname}:${DEV_BACKEND_PORT}`;
  }
  return `http://127.0.0.1:${DEV_BACKEND_PORT}`;
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
    // On local dev, hit Django directly instead of going through Next.js
    // rewrites. The proxy layer can normalize trailing slashes on POST routes,
    // which breaks Django endpoints protected by APPEND_SLASH.
    if (host === "localhost" || host === "127.0.0.1") {
      return `http://127.0.0.1:${DEV_BACKEND_PORT}`;
    }
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