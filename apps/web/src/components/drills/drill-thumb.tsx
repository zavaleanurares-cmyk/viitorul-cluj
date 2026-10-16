import { ImageOff } from "lucide-react";
import { getT } from "@/messages";
import { diagramCounts } from "./diagram-schema";
import { PitchSvg } from "./pitch-svg";
import type { DrillRow } from "./queries";

/** Imaginea din card: schema desenată sau, dacă nu există, prima imagine încărcată. */
export function DrillThumb({ drill, className = "aspect-[105/68] w-full" }: { drill: Pick<DrillRow, "id" | "diagram" | "image_paths">; className?: string }) {
  const t = getT().drills;
  if (drill.diagram?.items.length) {
    const c = diagramCounts(drill.diagram);
    return <PitchSvg diagram={drill.diagram} uid={`d${drill.id.slice(0, 8)}`} label={t.editor.summary(c.players, c.others, c.arrows)} className={`block bg-[#2f7d32] ${className}`} preserveAspectRatio="xMidYMid meet" />;
  }
  if (drill.image_paths[0]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/drills/${drill.image_paths[0]}`} alt="" loading="lazy" className={`block bg-sunken object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center gap-2 bg-sunken text-sm text-ink-3 ${className}`}>
      <ImageOff className="size-5" aria-hidden />{t.noImage}
    </div>
  );
}
