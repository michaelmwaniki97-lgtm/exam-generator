import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["cables-preparing-celebrities-broker.trycloudflare.com"],
  output: "standalone",
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/*": ["node_modules/pdfjs-dist/**/*"],
  },
  // Keep static-generation memory predictable on Windows and small CI runners.
  experimental: { cpus: 1, serverActions: { bodySizeLimit: "13mb" }, useTypeScriptCli: false },
};

export default nextConfig;
