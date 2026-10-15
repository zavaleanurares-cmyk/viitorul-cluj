/**
 * Linkul unei notificări este scris de triggerele din baza de date (`/azi`, `/plan?zi=…`, `/jucatori/<id>`…).
 * Acceptăm doar căi interne, ca o valoare greșită să nu poată trimite utilizatorul în afara aplicației.
 */
export function safeInternalLink(link: string | null | undefined): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.includes("\\") || /[\r\n]/.test(link)) return null;
  return link;
}

export const KNOWN_KINDS = [
  "wellness_reminder", "plan_new", "program_new", "status_changed", "alert", "visa_expiring",
  "fee_issued", "fee_reminder", "charge_request", "payment_received", "purchase_request",
  "visa_document", "visa_reminder", "rpe_request", "evaluation_published", "evaluation_round", "video_shared", "message", "contract_sign", "shop_order", "enrolment", "camp", "news", "supporters",
] as const;
export type KnownKind = (typeof KNOWN_KINDS)[number];

export function knownKind(kind: string): KnownKind | "other" {
  return (KNOWN_KINDS as readonly string[]).includes(kind) ? (kind as KnownKind) : "other";
}
