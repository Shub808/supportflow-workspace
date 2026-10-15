import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  typedRoutes: true,
  // `node:sqlite` is a Node built-in; keep it out of the bundler's graph.
  serverExternalPackages: [],
};

export default nextConfig;
