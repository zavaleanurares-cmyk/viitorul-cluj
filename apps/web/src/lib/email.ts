import "server-only";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/**
 * Trimite un e-mail prin Resend. Fără RESEND_API_KEY nu face nimic și întoarce false —
 * notificările rămân vizibile în aplicație.
 * Conținutul e-mailurilor nu include niciodată date medicale: doar faptul că există ceva nou și un link.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!emailConfigured()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
  });
  if (!res.ok) console.error("[e-mail]", res.status, await res.text().catch(() => ""));
  return res.ok;
}
