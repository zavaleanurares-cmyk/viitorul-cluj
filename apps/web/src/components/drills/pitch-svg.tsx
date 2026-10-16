import type { PointerEvent as ReactPointerEvent } from "react";
import { PITCHES, type Diagram, type DiagramItem } from "./diagram-schema";

const PAD = 3;
const LINE = "rgb(255 255 255 / 0.9)";
export const TEAM_FILL = { a: "#d70015", b: "#0071e3", n: "#ffcc00" } as const;
export const GK_FILL = { a: "#ff9500", b: "#5e5ce6" } as const;

/** Liniile terenului (în metri). Jumătatea are poarta sus și linia de mijloc jos. */
function Markings({ pitch }: { pitch: Diagram["pitch"] }) {
  const { w, h } = PITCHES[pitch];
  const common = { fill: "none", stroke: LINE, strokeWidth: 0.3 } as const;
  if (pitch === "area") return <rect x={0} y={0} width={w} height={h} {...common} />;
  const cy = h / 2;
  const box = (side: "l" | "r") => {
    const x0 = side === "l" ? 0 : w;
    const dir = side === "l" ? 1 : -1;
    const arcX = x0 + dir * 16.5;
    const dy = 7.31;
    return (
      <g key={side}>
        <rect x={side === "l" ? 0 : w - 16.5} y={cy - 20.16} width={16.5} height={40.32} {...common} />
        <rect x={side === "l" ? 0 : w - 5.5} y={cy - 9.16} width={5.5} height={18.32} {...common} />
        <circle cx={x0 + dir * 11} cy={cy} r={0.35} fill={LINE} />
        <path d={`M${arcX},${cy - dy} A9.15,9.15 0 0,${side === "l" ? 1 : 0} ${arcX},${cy + dy}`} {...common} />
        <rect x={side === "l" ? -1.8 : w} y={cy - 3.66} width={1.8} height={7.32} {...common} />
      </g>
    );
  };
  if (pitch === "full") {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} {...common} />
        <line x1={w / 2} y1={0} x2={w / 2} y2={h} {...common} />
        <circle cx={w / 2} cy={cy} r={9.15} {...common} />
        <circle cx={w / 2} cy={cy} r={0.35} fill={LINE} />
        {box("l")}
        {box("r")}
      </g>
    );
  }
  // jumătatea: poarta sus, linia de mijloc jos
  const cx = w / 2;
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} {...common} />
      <path d={`M${cx - 9.15},${h} A9.15,9.15 0 0,1 ${cx + 9.15},${h}`} {...common} />
      <circle cx={cx} cy={h} r={0.35} fill={LINE} />
      <rect x={cx - 20.16} y={0} width={40.32} height={16.5} {...common} />
      <rect x={cx - 9.16} y={0} width={18.32} height={5.5} {...common} />
      <circle cx={cx} cy={11} r={0.35} fill={LINE} />
      <path d={`M${cx - 7.31},16.5 A9.15,9.15 0 0,0 ${cx + 7.31},16.5`} {...common} />
      <rect x={cx - 3.66} y={-1.8} width={7.32} height={1.8} {...common} />
    </g>
  );
}

/** Linia ondulată a conducerii de minge, de la (x,y) la (x2,y2). */
function wavyPath(x: number, y: number, x2: number, y2: number) {
  const dx = x2 - x, dy = y2 - y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const steps = Math.max(2, Math.floor((len - 1.5) / 1.4));
  let d = `M${x},${y}`;
  for (let i = 1; i <= steps; i++) {
    const t = (i * (len - 1.5)) / steps;
    const off = (i % 2 ? 0.7 : -0.7);
    d += ` L${x + ux * t - uy * off},${y + uy * t + ux * off}`;
  }
  return `${d} L${x2},${y2}`;
}

function Item({ it, selected, uid, onPointerDown }: {
  it: DiagramItem; selected: boolean; uid: string; onPointerDown?: (e: ReactPointerEvent<SVGGElement>, it: DiagramItem) => void;
}) {
  const handlers = onPointerDown ? { onPointerDown: (e: ReactPointerEvent<SVGGElement>) => onPointerDown(e, it), style: { cursor: "move" } } : {};
  const ring = (
    <>
      {/* în editor: zonă de apăsare mai mare decât elementul, pentru degete */}
      {onPointerDown && it.t !== "arrow" ? <circle cx={it.x} cy={it.y} r={3} fill="transparent" /> : null}
      {selected ? <circle cx={it.x} cy={it.y} r={2.4} fill="none" stroke="#fff" strokeWidth={0.35} strokeDasharray="0.8 0.5" /> : null}
    </>
  );
  switch (it.t) {
    case "player":
      return (
        <g {...handlers}>
          {ring}
          <circle cx={it.x} cy={it.y} r={1.5} fill={TEAM_FILL[it.team]} stroke="#fff" strokeWidth={0.25} />
          {it.label ? (
            <text x={it.x} y={it.y + 0.55} textAnchor="middle" fontSize={1.6} fontWeight={600} fill={it.team === "n" ? "#1d1d1f" : "#fff"} style={{ pointerEvents: "none" }}>{it.label}</text>
          ) : null}
        </g>
      );
    case "gk":
      return (
        <g {...handlers}>
          {ring}
          <rect x={it.x - 1.5} y={it.y - 1.5} width={3} height={3} rx={0.6} fill={GK_FILL[it.team]} stroke="#fff" strokeWidth={0.25} />
          <text x={it.x} y={it.y + 0.55} textAnchor="middle" fontSize={1.5} fontWeight={600} fill="#fff" style={{ pointerEvents: "none" }}>P</text>
        </g>
      );
    case "cone":
      return (
        <g {...handlers}>
          {ring}
          <path d={`M${it.x},${it.y - 1.1} L${it.x + 1},${it.y + 0.8} L${it.x - 1},${it.y + 0.8} Z`} fill="#ff9500" stroke="#fff" strokeWidth={0.15} />
        </g>
      );
    case "ball":
      return (
        <g {...handlers}>
          {ring}
          <circle cx={it.x} cy={it.y} r={0.95} fill="#fff" stroke="#1d1d1f" strokeWidth={0.22} />
          <circle cx={it.x} cy={it.y} r={0.32} fill="#1d1d1f" />
        </g>
      );
    case "goal":
      return (
        <g {...handlers} transform={`rotate(${it.r} ${it.x} ${it.y})`}>
          {ring}
          <rect x={it.x - 1.5} y={it.y - 0.6} width={3} height={1.2} fill="rgb(255 255 255 / 0.25)" stroke="#fff" strokeWidth={0.25} />
          <line x1={it.x - 1.5} y1={it.y + 0.6} x2={it.x + 1.5} y2={it.y + 0.6} stroke="#fff" strokeWidth={0.45} />
        </g>
      );
    case "arrow": {
      const stroke = selected ? "#ffd60a" : "#fff";
      const common = { fill: "none", stroke, strokeWidth: 0.35, markerEnd: `url(#${uid}-${selected ? "sel" : "n"})` } as const;
      return (
        <g {...handlers}>
          {/* zonă de apăsare mai lată decât linia */}
          {onPointerDown ? <line x1={it.x} y1={it.y} x2={it.x2} y2={it.y2} stroke="transparent" strokeWidth={2.4} /> : null}
          {it.kind === "dribble" ? <path d={wavyPath(it.x, it.y, it.x2, it.y2)} {...common} />
            : <line x1={it.x} y1={it.y} x2={it.x2} y2={it.y2} {...common} strokeDasharray={it.kind === "pass" ? "1 0.7" : undefined} />}
        </g>
      );
    }
  }
}

/** Schema desenată: teren, elemente, săgeți. Folosită în editor, în bibliotecă și la tipărire. */
export function PitchSvg({ diagram, label, uid = "pitch", selectedId, onItemPointerDown, svgRef, className, ...rest }: {
  diagram: Diagram;
  /** prefix pentru id-urile interne (săgeți), unic pe pagină */
  uid?: string;
  label: string;
  selectedId?: string | null;
  onItemPointerDown?: (e: ReactPointerEvent<SVGGElement>, it: DiagramItem) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  className?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "ref">) {
  const { w, h } = PITCHES[diagram.pitch];
  const stripe = diagram.pitch === "area" ? w / 8 : 105 / 14;
  const stripes = Array.from({ length: Math.ceil(w / stripe) }, (_, i) => i).filter((i) => i % 2 === 0);
  // săgețile sub jucători, ca jucătorii să rămână ușor de apucat
  const ordered = [...diagram.items.filter((i) => i.t === "arrow"), ...diagram.items.filter((i) => i.t !== "arrow")];
  return (
    <svg ref={svgRef} viewBox={`${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`} role="img" aria-label={label} className={className} {...rest}>
      <defs>
        {(["n", "sel"] as const).map((k) => (
          <marker key={k} id={`${uid}-${k}`} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={k === "sel" ? "#ffd60a" : "#fff"} />
          </marker>
        ))}
      </defs>
      <rect x={-PAD} y={-PAD} width={w + PAD * 2} height={h + PAD * 2} fill="#2f7d32" />
      {stripes.map((i) => <rect key={i} x={i * stripe} y={0} width={Math.min(stripe, w - i * stripe)} height={h} fill="#368a39" />)}
      <Markings pitch={diagram.pitch} />
      {ordered.map((it) => <Item key={it.id} it={it} uid={uid} selected={it.id === selectedId} onPointerDown={onItemPointerDown} />)}
    </svg>
  );
}
