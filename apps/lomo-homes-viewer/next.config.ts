import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/lomo-homes-viewer',
  // Enable standalone output for Docker deployment
  output: "standalone",
  images: {
    // Images are loaded directly from cdn.assets.lomography.com via <img> tags.
    // The CDN auth tokens are path-specific and cannot be modified by an
    // optimization proxy. This setting disables Next.js <Image> optimization
    // to prevent accidental URL rewriting.
    unoptimized: true,
  },
};

export default nextConfig;
