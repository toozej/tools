import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/unit-converter',
  assetPrefix: '/unit-converter',
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
