import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Gli screenshot arrivano già ridotti dal browser; 3 MB lasciano margine senza permettere caricamenti enormi.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
