// Server-side backend URL used by Next.js rewrites (proxying).
// Derives the port from NEXT_PUBLIC_BACKEND_PORT so there is a single source
// of truth — set it in .env and both the browser and proxy use the same port.
const BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || "8000";
// Falls back to NEXT_PUBLIC_API_URL/NEXT_PUBLIC_API_BASE_URL (the same vars
// frontend/lib/api.ts reads) so a cross-device setup — backend running on
// another machine on the LAN — also works for requests proxied through this
// rewrite, not just the ones frontend code sends directly to API_BASE_URL.
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  `http://127.0.0.1:${BACKEND_PORT}`;

const nextConfig = {
  reactStrictMode: true,
  basePath: "",
  // Allow Next.js dev server to serve _next/* assets to eskoolia subdomains
  allowedDevOrigins: ["*.eskoolia.local", "192.168.1.40"],
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Proxy all Django API paths through the Next.js server so the same
  // hostname (e.g. zphschool.eskoolia.com) works for both the frontend
  // and the backend without requiring nginx to split traffic.
  async rewrites() {
    return [
      // Main versioned API
      { source: "/api/v1/:path*", destination: `${BACKEND_URL}/api/v1/:path*` },
      // Legacy compatibility paths used by some views
      { source: "/api/master/:path*", destination: `${BACKEND_URL}/api/master/:path*` },
      { source: "/api/fees/:path*", destination: `${BACKEND_URL}/api/fees/:path*` },
      { source: "/api/super-admin/:path*", destination: `${BACKEND_URL}/api/super-admin/:path*` },
      { source: "/api/chat/:path*", destination: `${BACKEND_URL}/api/chat/:path*` },
      { source: "/api/notes/:path*", destination: `${BACKEND_URL}/api/notes/:path*` },
      { source: "/admissions/:path*", destination: `${BACKEND_URL}/admissions/:path*` },
    ];
  },

  webpack: (config, { dev, isServer }) => {
    // Avoid intermittent Windows file-lock rename failures in .next/cache/webpack.
    if (dev) {
      config.cache = { type: "memory" };
    }

    return config;
  },
};

export default nextConfig;