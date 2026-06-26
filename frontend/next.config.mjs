// Server-side backend URL used by Next.js rewrites (proxying).
// Set BACKEND_URL on the production server to point to Django
// (e.g. http://localhost:8000 when frontend and backend share the same VM).
// On local dev the rewrites are effectively unused because the browser
// already calls http://localhost:8000 directly.
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

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