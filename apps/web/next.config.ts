import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321").host;
  } catch {
    return "localhost:54321";
  }
})();

const nextConfig: NextConfig = {
  // Aplicația este integral autentificată și dinamică: fiecare pagină depinde de utilizator.
  // Folosim modelul clasic de randare la cerere (vezi DECIZII.md).
  cacheComponents: false,
  devIndicators: false,
  transpilePackages: ["@club/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [{ protocol: supabaseHost.startsWith("localhost") ? "http" : "https", hostname: supabaseHost.split(":")[0] }],
  },
};

export default nextConfig;
