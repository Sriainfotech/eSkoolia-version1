/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  basePath: "",
  // Allow Next.js dev server to serve _next/* assets to eskoolia subdomains
  allowedDevOrigins: ["*.eskoolia.local"],
  eslint: {
    ignoreDuringBuilds: true,
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
