/** Adresa publică a aplicației (folosită în linkurile de invitație și în e-mailuri). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/** Numele afișat înainte de autentificare și la instalarea ca aplicație. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Vestiar";
