/** Sursele video acceptate și cum se redau (faza 4). */
export type MatchVideoSource = "veo" | "youtube" | "vimeo" | "upload" | "other";
export type VideoTag = "goal" | "chance" | "defending" | "set_piece" | "mistake" | "highlight" | "other";
export const VIDEO_TAGS: VideoTag[] = ["goal", "chance", "defending", "set_piece", "mistake", "highlight", "other"];

/** Recunoaște sursa unei adrese și, unde se poate, identificatorul pentru redarea în pagină. */
export function parseMatchVideoUrl(raw: string): { source: Exclude<MatchVideoSource, "upload">; id: string | null; url: string } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return { source: "youtube", id: u.pathname.slice(1).split("/")[0] || null, url: u.href };
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    const m = /^\/(embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
    return { source: "youtube", id: v ?? m?.[2] ?? null, url: u.href };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(?:video\/)?(\d+)/.exec(u.pathname);
    return { source: "vimeo", id: m?.[1] ?? null, url: u.href };
  }
  if (host === "veo.co" || host.endsWith(".veo.co")) return { source: "veo", id: null, url: u.href };
  return { source: "other", id: null, url: u.href };
}

/** „1:05:30" / „12:04" pentru secunde. */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** „12:04", „1:05:30" sau „724" (secunde) → secunde; null dacă nu se poate citi. */
export function parseClock(text: string): number | null {
  const v = text.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x > 59)) return null;
  return n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
}

/** Adresa de redare a unui interval (YouTube / Vimeo); pentru VEO și alte surse: adresa originală. */
export function clipEmbedUrl(source: MatchVideoSource, url: string | null, start: number, end: number | null): string | null {
  const p = url ? parseMatchVideoUrl(url) : null;
  if (source === "youtube" && p?.id) {
    const q = new URLSearchParams({ start: String(start), rel: "0", modestbranding: "1" });
    if (end) q.set("end", String(end));
    return `https://www.youtube-nocookie.com/embed/${p.id}?${q.toString()}`;
  }
  if (source === "vimeo" && p?.id) return `https://player.vimeo.com/video/${p.id}#t=${start}s`;
  return null;
}
