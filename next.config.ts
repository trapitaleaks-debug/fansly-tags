import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/fansly-egress.mjs (Fansly proxy helper) loads undici from node_modules at runtime.
  serverExternalPackages: ["undici"],
};

export default nextConfig;
