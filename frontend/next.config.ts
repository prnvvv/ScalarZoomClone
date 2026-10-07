import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.10"],
  // Standalone output lets the frontend run inside a minimal Docker container
  // on Cloud Run without the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
