// Integrarea Supabase din Vercel Marketplace injectează aceste variabile automat.
// Acceptăm atât denumirile clasice (ANON / SERVICE_ROLE), cât și cele noi (PUBLISHABLE / SECRET).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Vestiar";
