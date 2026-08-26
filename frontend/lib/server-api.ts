const BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || "8000";

/**
 * Backend base URL for a server-side (Route Handler) request.
 *
 * Must be derived fresh from the INCOMING request's own Host header, not a
 * module-level constant from NEXT_PUBLIC_API_URL - that env var is baked
 * into the build once and would be the same fixed value for every tenant
 * subdomain. Django resolves "which school" purely from the Host header it
 * receives (apps/tenancy/resolvers.py), so a route handler serving
 * testschool.eskoolia.com must forward to testschool.eskoolia.com, not
 * whatever single origin happened to be baked in at build time.
 */
export function getBackendBaseUrl(req: Request): string {
  const rawHost = req.headers.get("host") || "";
  const hostname = rawHost.split(":")[0];
  const proto = req.headers.get("x-forwarded-proto") || "https";

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://127.0.0.1:${BACKEND_PORT}`;
  }
  if (/devtunnels\.ms$/i.test(hostname) || /\.githubpreview\.dev$/i.test(hostname)) {
    const apiHost = hostname.replace(/-3000\./, `-${BACKEND_PORT}.`);
    return `${proto}://${apiHost}`;
  }
  if (hostname.endsWith(".eskoolia.com") || hostname === "eskoolia.com") {
    // Production: same hostname, behind Nginx on standard ports - keeps the
    // request's Host header intact so Django resolves the right tenant.
    return `${proto}://${rawHost}`;
  }
  return `${proto}://${hostname}:${BACKEND_PORT}`;
}
