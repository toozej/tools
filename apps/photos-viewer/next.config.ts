import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/photos-viewer',
  // Enable standalone output for Docker deployment
  output: "standalone",
  images: {
    // Source images load directly. Lomography CDN tokens are path-specific.
    unoptimized: true,
  },
};

export default nextConfig;
