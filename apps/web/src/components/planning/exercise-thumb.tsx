import { Dumbbell, Play, VideoOff } from "lucide-react";
import { cn } from "@/lib/cn";

/** Miniatura unui exercițiu: imaginea lui sau un cadru neutru cu pictogramă. */
export function ExerciseThumb({ imageUrl, hasVideo, className }: { imageUrl: string | null; hasVideo: boolean; className?: string }) {
  return (
    <span className={cn("relative flex aspect-video shrink-0 items-center justify-center overflow-hidden rounded-md bg-sunken text-ink-3", className)} aria-hidden>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : hasVideo ? (
        <Dumbbell className="size-1/3 max-h-8" />
      ) : (
        <VideoOff className="size-1/3 max-h-8" />
      )}
      {hasVideo ? (
        <span className="absolute bottom-1 right-1 inline-flex size-5 items-center justify-center rounded bg-ink/85 text-white">
          <Play className="size-3 fill-current" />
        </span>
      ) : null}
    </span>
  );
}
