import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/film-format-converter',
  assetPrefix: '/film-format-converter',
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
