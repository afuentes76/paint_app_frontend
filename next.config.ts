import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // 1) FIX: map this special frontend endpoint to the backend public endpoint
      {
        source: "/api/tasks/public/qr/:qrToken",
        destination: "http://127.0.0.1:8000/public/qr/:qrToken",
      },

      // 2) Keep your existing catch-all
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
