import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplicația este integral autentificată și dinamică: fiecare pagină depinde de utilizator.
  // Folosim modelul clasic de randare la cerere (vezi DECIZII.md).
  cacheComponents: false,
  devIndicators: false,
  transpilePackages: ["@club/shared", "@club/db", "@club/seed"],
  serverExternalPackages: ["pg"],
  // Fonturile încorporate în PDF-uri se citesc de pe disc la cerere; fără această cheie nu ajung în funcțiile de pe Vercel.
  outputFileTracingIncludes: {
    "/rapoarte/**": ["./src/components/reports/fonts/*.ttf"],
    // chitanțe, dovezi de plată, referate, contracte
    "/api/**": ["./src/components/reports/fonts/*.ttf"],
  },
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
  // Fișa medicală din Vestiar a devenit o parte a fișei din Lot (faza 4); linkurile vechi (inclusiv cele
  // scrise în notificări de baza de date) duc la aceeași filă.
  async redirects() {
    return [
      { source: "/jucatori", destination: "/lot", permanent: false },
      { source: "/jucatori/:id", destination: "/lot/jucatori/:id/stare", permanent: false },
      { source: "/jucatori/:id/:tab(medical|wellness|fizic|plan|documente)", destination: "/lot/jucatori/:id/:tab", permanent: false },
    ];
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
};

export default nextConfig;
