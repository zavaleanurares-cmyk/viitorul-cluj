import { ExternalLink, VideoOff } from "lucide-react";
import { parseVideoUrl } from "@club/shared";

/**
 * Clipul de execuție al unui exercițiu.
 *  - `fileUrl`: link semnat către un clip încărcat de club (bucketul privat „exercise-media");
 *  - `url`: link extern (YouTube / Vimeo / fișier video);
 *  - `imageUrl`: imagine statică, dacă nu există clip.
 */
export function ExerciseMedia({ title, fileUrl, url, imageUrl, attribution }: {
  title: string; fileUrl?: string | null; url?: string | null; imageUrl?: string | null; attribution?: string | null;
}) {
  const src = parseVideoUrl(url);
  // fără imagine de copertă, cerem primul cadru al clipului (altfel pe iPhone rămâne un dreptunghi negru)
  const firstFrame = (u: string) => (imageUrl || u.includes("#") ? u : `${u}#t=0.1`);
  let media: React.ReactNode;
  if (fileUrl) {
    media = <video src={firstFrame(fileUrl)} controls playsInline preload="metadata" poster={imageUrl ?? undefined} className="aspect-video w-full bg-ink" />;
  } else if (src?.kind === "youtube" || src?.kind === "vimeo") {
    media = (
      <iframe
        src={src.embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video w-full border-0 bg-ink"
      />
    );
  } else if (src?.kind === "file") {
    media = <video src={firstFrame(src.url)} controls playsInline preload="metadata" poster={imageUrl ?? undefined} className="aspect-video w-full bg-ink" />;
  } else if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    media = <img src={imageUrl} alt={`Execuție: ${title}`} loading="lazy" className="aspect-video w-full bg-sunken object-contain" />;
  } else {
    media = (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-sunken text-ink-3">
        <VideoOff className="size-8" aria-hidden />
        <span className="text-sm">Clip indisponibil. Urmează pașii descriși.</span>
      </div>
    );
  }
  return (
    <figure className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {media}
      {src?.kind === "link" ? (
        <a href={src.url} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-2 px-3 font-semibold underline">
          <ExternalLink className="size-4" aria-hidden /> Deschide clipul
        </a>
      ) : null}
      {attribution ? <figcaption className="px-3 py-1.5 text-xs text-ink-3">{attribution}</figcaption> : null}
    </figure>
  );
}
