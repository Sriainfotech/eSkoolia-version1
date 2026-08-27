import { NextRequest, NextResponse } from "next/server";

/**
 * Defense in depth on top of the is_superuser check in
 * app/(super-admin)/layout.tsx: the platform console has no legitimate
 * reason to be reachable from a tenant subdomain, even for an authenticated
 * superuser. Restricting it to app.eskoolia.com means a leaked/stolen
 * super-admin session can't be used from anywhere else.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] || "";

  const isLocalOrDev =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".eskoolia.local") ||
    /devtunnels\.ms$/i.test(hostname) ||
    /\.githubpreview\.dev$/i.test(hostname);

  if (isLocalOrDev || hostname === "app.eskoolia.com") {
    return NextResponse.next();
  }

  // request.nextUrl.clone(), not `new URL(path, request.url)` - the latter
  // resolved to the internal Next.js server address (localhost:3004)
  // instead of the real public hostname when running behind Nginx.
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/super-admin/:path*",
};
