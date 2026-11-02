import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Verification builds can go to their own folder (NEXT_DIST_DIR=.next-verify) so they never overwrite a running `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
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
