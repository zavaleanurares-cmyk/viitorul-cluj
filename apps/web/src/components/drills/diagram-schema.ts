import { z } from "zod";

/**
 * Schema pe teren a unei secțiuni. Coordonatele sunt în metri, cu originea în colțul stânga-sus:
 * terenul întreg are 105 × 68, jumătatea 68 × 52,5 (poarta sus), iar zona liberă 40 × 30.
 */
export const PITCHES = { full: { w: 105, h: 68 }, half: { w: 68, h: 52.5 }, area: { w: 40, h: 30 } } as const;
export type PitchKind = keyof typeof PITCHES;

const coord = z.number().min(-5).max(110);
const id = z.string().min(1).max(12);

export const DiagramItem = z.discriminatedUnion("t", [
  z.object({ id, t: z.literal("player"), x: coord, y: coord, team: z.enum(["a", "b", "n"]), label: z.string().max(3).optional() }),
  z.object({ id, t: z.literal("gk"), x: coord, y: coord, team: z.enum(["a", "b"]) }),
  z.object({ id, t: z.literal("cone"), x: coord, y: coord }),
  z.object({ id, t: z.literal("ball"), x: coord, y: coord }),
  z.object({ id, t: z.literal("goal"), x: coord, y: coord, r: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]) }),
  z.object({ id, t: z.literal("arrow"), x: coord, y: coord, x2: coord, y2: coord, kind: z.enum(["pass", "run", "dribble"]) }),
]);
export type DiagramItem = z.infer<typeof DiagramItem>;

export const Diagram = z.object({
  pitch: z.enum(["full", "half", "area"]),
  items: z.array(DiagramItem).max(120),
});
export type Diagram = z.infer<typeof Diagram>;

export const emptyDiagram = (pitch: PitchKind = "half"): Diagram => ({ pitch, items: [] });

export function diagramCounts(d: Diagram) {
  const players = d.items.filter((i) => i.t === "player" || i.t === "gk").length;
  const arrows = d.items.filter((i) => i.t === "arrow").length;
  return { players, arrows, others: d.items.length - players - arrows };
}
