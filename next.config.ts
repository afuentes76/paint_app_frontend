import type { NextConfig } from "next";

const API_BASE_URL =
  process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/tasks/public/qr/:qrToken",
        destination: `${API_BASE_URL}/public/qr/:qrToken`,
      },
      {
        source: "/api/:path*",
        destination: `${API_BASE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;