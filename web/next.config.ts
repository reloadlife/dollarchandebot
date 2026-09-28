import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // The repo root also has a lockfile. Keep this app's root here.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
