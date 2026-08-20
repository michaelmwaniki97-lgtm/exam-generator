import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep static-generation memory predictable on Windows and small CI runners.
  experimental: { cpus: 1 },
};

export default nextConfig;
