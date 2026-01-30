import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/yaml-formatter',
  assetPrefix: '/yaml-formatter',
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
