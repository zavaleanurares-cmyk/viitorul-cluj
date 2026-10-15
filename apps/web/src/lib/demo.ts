import "server-only";

/**
 * Clubul demo: date inventate, conturi pentru fiecare rol, intrare fără parolă din /demo.
 * Ce nu iese niciodată din demo: e-mailuri (invitații, resetări, rezumate) și fișiere mari.
 */
export const DEMO_SLUG = "club-demo";

/** Intrarea fără parolă se poate opri din Vercel cu DEMO_LOGIN=off. */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN !== "off";
}

export const DEMO_ROLES = ["patron", "director", "secretariat", "contabil", "antrenor.juniori", "preparator", "parinte", "jucator"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export function demoEmailDomain(): string {
  return (process.env.DEMO_EMAIL_DOMAIN ?? "example.com").toLowerCase();
}

export function demoEmail(role: DemoRole): string {
  return `${role}.demo@${demoEmailDomain()}`;
}

/**
 * În clubul demo (unde oricine intră fără parolă) un cont nou sau o adresă schimbată rămân pe domeniul demo.
 * Altfel, un vizitator ar putea crea aici contul unei persoane reale și l-ar primi apoi într-un club adevărat.
 */
export function demoEmailAllowed(club: { slug: string }, email: string): boolean {
  return !isDemoClub(club) || email.trim().toLowerCase().endsWith(`@${demoEmailDomain()}`);
}

export function isDemoClub(club: { slug: string } | null | undefined): boolean {
  return club?.slug === DEMO_SLUG;
}

/** În demo, un fișier încărcat are cel mult 5 MB, indiferent de tipul lui. */
export const DEMO_MAX_UPLOAD = 5 * 1024 * 1024;
