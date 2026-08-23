import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  // Keep static-generation memory predictable on Windows and small CI runners.
  experimental: { cpus: 1, serverActions: { bodySizeLimit: "13mb" } },
};

export default nextConfig;
