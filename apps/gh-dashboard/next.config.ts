import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/gh-dashboard',
  // Enable standalone output for Docker deployment
  output: "standalone",
};

export default nextConfig;
