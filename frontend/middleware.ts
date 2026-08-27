import { NextRequest, NextResponse } from "next/server";

/**
 * Keeps app.eskoolia.com and every other *.eskoolia.com subdomain on
 * opposite sides of a hard line:
 *   - app.eskoolia.com serves ONLY the platform console (/super-admin/*).
 *     Any regular tenant-app page requested there (/home, /login, etc.)
 *     redirects to the super-admin login instead - "app" is a reserved,
 *     non-tenant subdomain (apps/tenancy/resolvers.py) and would otherwise
 *     render broken per-school widgets for an account with no school.
 *   - Every other subdomain serves the regular app, NEVER /super-admin/*.
 *     This is defense in depth on top of the is_superuser check in
 *     app/(super-admin)/layout.tsx: a leaked/stolen super-admin session
 *     still couldn't be used from a tenant subdomain.
 */
export function middleware(request: NextRequest) {
  const rawHost = request.headers.get("host") || "";
  const hostname = rawHost.split(":")[0];
  const pathname = request.nextUrl.pathname;

  const isLocalOrDev =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".eskoolia.local") ||
    /devtunnels\.ms$/i.test(hostname) ||
    /\.githubpreview\.dev$/i.test(hostname);

  if (isLocalOrDev) {
    return NextResponse.next();
  }

  const isAppHost = hostname === "app.eskoolia.com";
  const isSuperAdminPath = pathname.startsWith("/super-admin");

  if (isAppHost === isSuperAdminPath) {
    return NextResponse.next();
  }

  // Not request.nextUrl.clone() / new URL(path, request.url) - both resolve
  // against Next.js's own server bind address (localhost:3004) rather than
  // the real public hostname when running behind Nginx, even though the raw
  // Host header itself is correctly forwarded. Build the redirect target
  // from that raw header directly instead.
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const target = isAppHost ? "/super-admin/login" : "/login";
  return NextResponse.redirect(`${proto}://${rawHost}${target}`);
}

export const config = {
  // Everything except Next.js internals and files with an extension
  // (images, favicon, etc. under public/) - those must load on every host.
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
