import { NextRequest, NextResponse } from "next/server";

/**
 * Defense in depth on top of the is_superuser check in
 * app/(super-admin)/layout.tsx: the platform console has no legitimate
 * reason to be reachable from a tenant subdomain, even for an authenticated
 * superuser. Restricting it to app.eskoolia.com means a leaked/stolen
 * super-admin session can't be used from anywhere else.
 */
export function middleware(request: NextRequest) {
  const rawHost = request.headers.get("host") || "";
  const hostname = rawHost.split(":")[0];

  const isLocalOrDev =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".eskoolia.local") ||
    /devtunnels\.ms$/i.test(hostname) ||
    /\.githubpreview\.dev$/i.test(hostname);

  if (isLocalOrDev || hostname === "app.eskoolia.com") {
    return NextResponse.next();
  }

  // Not request.nextUrl.clone() / new URL(path, request.url) - both resolve
  // against Next.js's own server bind address (localhost:3004) rather than
  // the real public hostname when running behind Nginx, even though the raw
  // Host header itself is correctly forwarded. Build the redirect target
  // from that raw header directly instead.
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return NextResponse.redirect(`${proto}://${rawHost}/login`);
}

export const config = {
  matcher: "/super-admin/:path*",
};
