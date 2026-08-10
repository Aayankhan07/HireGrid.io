import type { NextConfig } from "next";

// Where the FastAPI backend lives. In the Docker image nginx routes /api before
// Next.js ever sees it, so this rewrite is what makes non-nginx deployments
// (local dev, Vercel, a separate API host) work.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
