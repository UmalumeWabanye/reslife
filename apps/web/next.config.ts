import type { NextConfig } from "next";

// Every page is per-user (behind the session cookie), so Cache Components / prerendering
// buys nothing here; pages render dynamically per request.
const nextConfig: NextConfig = {
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
