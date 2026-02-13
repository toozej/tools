import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/anki2epub',
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Use webpack instead of turbopack to support sql.js
  webpack: (config, { isServer }) => {
    // sql.js requires fs and path which are not available in the browser
    // We need to provide empty mocks for these Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
