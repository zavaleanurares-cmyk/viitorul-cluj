export type VideoSource =
  | { kind: "youtube" | "vimeo"; embedUrl: string; url: string }
  | { kind: "file"; url: string }
  | { kind: "link"; url: string };

/** Recunoaște linkurile YouTube / Vimeo / fișier video și întoarce adresa de încorporat. */
export function parseVideoUrl(input: string | null | undefined): VideoSource | null {
  const url = (input ?? "").trim();
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(embed|shorts|live|v)\/([^/?]+)/.exec(u.pathname);
      if (m) id = m[2];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) {
      const start = u.searchParams.get("t") ?? u.searchParams.get("start");
      const s = start ? parseInt(start, 10) : 0;
      return { kind: "youtube", url, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${s ? `&start=${s}` : ""}` };
    }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /(\d{6,12})/.exec(u.pathname);
    if (m) return { kind: "vimeo", url, embedUrl: `https://player.vimeo.com/video/${m[1]}?playsinline=1` };
  }
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(u.pathname)) return { kind: "file", url };
  return { kind: "link", url };
}
