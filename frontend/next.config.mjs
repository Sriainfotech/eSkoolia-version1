/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  basePath: "",
  webpack: (config, { dev, isServer }) => {
    // Avoid intermittent Windows file-lock rename failures in .next/cache/webpack.
    if (dev) {
      config.cache = { type: "memory" };
    }

    return config;
  },
};

export default nextConfig;
