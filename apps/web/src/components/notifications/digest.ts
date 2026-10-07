import type { AppRole } from "@club/shared";
import { getT } from "@/messages";
import { knownKind } from "./links";

export type DigestItem = { kind: string };

/**
 * Titlul neutru al unei notificări, pentru e-mail. NU folosim titlul din baza de date: acela poate
 * conține numele unui jucător, starea lui sau o valoare din chestionar (ex. „POPESCU: ACC").
 */
export function neutralTitle(kind: string, role: AppRole): string {
  const n = getT().notifications.email.neutral;
  const k = knownKind(kind);
  if (k === "status_changed") return role === "player" ? n.status_self : n.status_staff;
  return n[k];
}

/** E-mailul-rezumat al unui utilizator: câte notificări are și ce fel, fără niciun detaliu medical. */
export function buildDigest(input: { role: AppRole; items: DigestItem[]; appName: string; siteUrl: string }): { subject: string; text: string } {
  const t = getT().notifications.email;
  const counts = new Map<string, number>();
  for (const it of input.items) {
    const title = neutralTitle(it.kind, input.role);
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const n = input.items.length;
  const lines = [...counts.entries()].map(([title, c]) => `• ${t.times(title, c)}`);
  const text = [
    t.greeting,
    "",
    t.intro(n, input.appName),
    ...lines,
    "",
    t.open,
    `${input.siteUrl}/notificari`,
    "",
    t.footer,
  ].join("\n");
  return { subject: t.subject(n, input.appName), text };
}
