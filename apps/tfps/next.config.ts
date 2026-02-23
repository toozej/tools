import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/tfps',
  assetPrefix: '/tfps',
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
