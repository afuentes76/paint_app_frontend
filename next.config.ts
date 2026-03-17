import type { NextConfig } from "next";

const API_BASE_URL =
  process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/tasks/public/qr/:qrToken",
        destination: `${API_BASE_URL}/api/tasks/public/qr/:qrToken`,
      },
    ];
  },
};

export default nextConfig;