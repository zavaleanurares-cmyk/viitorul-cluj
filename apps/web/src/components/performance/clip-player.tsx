import { ExternalLink } from "lucide-react";
import { clipEmbedUrl, formatClock, type MatchVideoSource } from "@club/shared";
import { getT } from "@/messages";

/**
 * Redarea unui clip: doar intervalul lui. YouTube / Vimeo în pagină, fișierul încărcat cu fragmentul de timp;
 * VEO și alte surse se deschid în aplicația lor, cu momentul scris lângă.
 */
export function ClipPlayer({ source, url, storagePath, start, end, title }: {
  source: MatchVideoSource; url: string | null; storagePath: string | null; start: number; end: number | null; title: string;
}) {
  const t = getT().performance.video;
  const embed = clipEmbedUrl(source, url, start, end);
  if (embed) {
    return <iframe src={embed} title={title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" className="aspect-video w-full rounded-[var(--radius-control)] bg-black" />;
  }
  if (source === "upload" && storagePath) {
    const src = `/api/files/videos/${storagePath.split("/").map(encodeURIComponent).join("/")}#t=${start}${end ? `,${end}` : ""}`;
    return <video src={src} controls preload="metadata" className="aspect-video w-full rounded-[var(--radius-control)] bg-black" />;
  }
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors">
      <ExternalLink className="size-5" aria-hidden />{t.openExternal(t.sources[source])} · {formatClock(start)}{end ? `–${formatClock(end)}` : ""}
    </a>
  ) : null;
}
