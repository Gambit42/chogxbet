import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Old standalone routes, now pages under /app.
  redirects: async () => [
    { source: "/faucet", destination: "/app/faucet", permanent: false },
    { source: "/profile", destination: "/app/profile", permanent: false },
  ],
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
