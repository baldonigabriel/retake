import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Community agent/map assets (CLAUDE.md › UI/UX). Agent icons are 1024px
    // PNGs (~400 KB) shown at 24–48px: resize them instead of shipping that.
    remotePatterns: [{ protocol: "https", hostname: "media.valorant-api.com", pathname: "/**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
