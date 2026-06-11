import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "https://facebook-routlis-backend.273nrg.easypanel.host";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
