import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/gh-dashboard',
  // Enable standalone output for Docker deployment
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/u/**',
      },
      {
        protocol: 'https',
        hostname: 'githubusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
