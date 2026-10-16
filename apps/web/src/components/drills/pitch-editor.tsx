"use client";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MousePointer2, RotateCw, Trash2, Undo2, Eraser } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { PITCHES, diagramCounts, type Diagram, type DiagramItem, type PitchKind } from "./diagram-schema";
import { GK_FILL, PitchSvg, TEAM_FILL } from "./pitch-svg";

type Tool = "select" | "playerA" | "playerB" | "neutral" | "gk" | "cone" | "ball" | "goal" | "pass" | "run" | "dribble";
const ARROWS: Tool[] = ["pass", "run", "dribble"];
const PLACE: Tool[] = ["playerA", "playerB", "neutral", "gk", "cone", "ball", "goal"];

const round = (n: number) => Math.round(n * 10) / 10;
const newId = () => Math.random().toString(36).slice(2, 10);

/** Pictograma unui instrument, desenată la fel ca pe teren. */
function ToolIcon({ tool }: { tool: Tool }) {
  const box = "size-6";
  switch (tool) {
    case "select": return <MousePointer2 className="size-5" aria-hidden />;
    case "playerA": case "playerB": case "neutral": {
      const fill = tool === "playerA" ? TEAM_FILL.a : tool === "playerB" ? TEAM_FILL.b : TEAM_FILL.n;
      return <svg viewBox="0 0 24 24" className={box} aria-hidden><circle cx={12} cy={12} r={8} fill={fill} stroke="#fff" strokeWidth={1.5} /></svg>;
    }
    case "gk": return <svg viewBox="0 0 24 24" className={box} aria-hidden><rect x={4} y={4} width={16} height={16} rx={3} fill={GK_FILL.a} /><text x={12} y={16.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">P</text></svg>;
    case "cone": return <svg viewBox="0 0 24 24" className={box} aria-hidden><path d="M12 4 L20 19 L4 19 Z" fill="#ff9500" /></svg>;
    case "ball": return <svg viewBox="0 0 24 24" className={box} aria-hidden><circle cx={12} cy={12} r={7} fill="#fff" stroke="#1d1d1f" strokeWidth={1.5} /><circle cx={12} cy={12} r={2.5} fill="#1d1d1f" /></svg>;
    case "goal": return <svg viewBox="0 0 24 24" className={box} aria-hidden><rect x={3} y={8} width={18} height={8} fill="none" stroke="currentColor" strokeWidth={1.8} /><path d="M3 16 H21" stroke="currentColor" strokeWidth={3} /></svg>;
    case "pass": return <svg viewBox="0 0 24 24" className={box} aria-hidden><path d="M3 18 L18 6" stroke="currentColor" strokeWidth={2} strokeDasharray="3 2.5" /><path d="M14 5 L20 4.5 L18.5 10.5 Z" fill="currentColor" /></svg>;
    case "run": return <svg viewBox="0 0 24 24" className={box} aria-hidden><path d="M3 18 L18 6" stroke="currentColor" strokeWidth={2} /><path d="M14 5 L20 4.5 L18.5 10.5 Z" fill="currentColor" /></svg>;
    case "dribble": return <svg viewBox="0 0 24 24" className={box} aria-hidden><path d="M3 18 L6 13 L8.5 16 L11 11 L13.5 14 L16 8.5" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M14 6 L20 4.5 L18.5 10.5 Z" fill="currentColor" /></svg>;
  }
}

/**
 * Editorul schemei pe teren: elementele se pun cu o apăsare, se mută trăgându-le,
 * iar săgețile se desenează trăgând de la punctul de plecare la cel de sosire.
 * Funcționează cu mouse, deget și tastatură (Delete șterge, săgețile mută elementul ales).
 */
export function PitchEditor({ value, onChange }: { value: Diagram; onChange: (d: Diagram) => void }) {
  const t = useT().drills.editor;
  const [tool, setTool] = useState<Tool>("playerA");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<DiagramItem | null>(null);
  const [history, setHistory] = useState<Diagram[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; orig: DiagramItem; moved: boolean } | null>(null);
  const { w, h } = PITCHES[value.pitch];

  const commit = useCallback((next: Diagram) => {
    setHistory((h) => [...h.slice(-49), value]);
    onChange(next);
  }, [value, onChange]);

  const point = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!;
    const m = el.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: round(Math.min(w + 2, Math.max(-2, p.x))), y: round(Math.min(h + 2, Math.max(-2, p.y))) };
  };

  const nextLabel = (team: "a" | "b" | "n") => {
    const used = new Set(value.items.flatMap((i) => (i.t === "player" && i.team === team && i.label ? [i.label] : [])));
    let n = 1;
    while (used.has(String(n))) n++;
    return String(n);
  };

  const place = (x: number, y: number): DiagramItem | null => {
    const id = newId();
    switch (tool) {
      case "playerA": return { id, t: "player", x, y, team: "a", label: nextLabel("a") };
      case "playerB": return { id, t: "player", x, y, team: "b", label: nextLabel("b") };
      case "neutral": return { id, t: "player", x, y, team: "n" };
      case "gk": return { id, t: "gk", x, y, team: value.items.some((i) => i.t === "gk" && i.team === "a") ? "b" : "a" };
      case "cone": return { id, t: "cone", x, y };
      case "ball": return { id, t: "ball", x, y };
      case "goal": return { id, t: "goal", x, y, r: 0 };
      default: return null;
    }
  };

  const startArrow = (e: ReactPointerEvent, x: number, y: number) => {
    svg.current?.setPointerCapture(e.pointerId);
    setDraft({ id: newId(), t: "arrow", x, y, x2: x, y2: y, kind: tool as "pass" | "run" | "dribble" });
  };

  const onBackground = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const { x, y } = point(e);
    if (ARROWS.includes(tool)) return startArrow(e, x, y);
    if (tool === "select") return setSelected(null);
    const it = place(x, y);
    if (it) {
      commit({ ...value, items: [...value.items, it] });
      setSelected(it.id);
    }
  };

  const onItem = (e: ReactPointerEvent<SVGGElement>, it: DiagramItem) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (ARROWS.includes(tool) && it.t !== "arrow") return startArrow(e, it.x, it.y);
    const p = point(e);
    // cu un element ales din bară, apăsarea pune elementul nou (de exemplu mingea la piciorul jucătorului)
    if (PLACE.includes(tool)) {
      const added = place(p.x, p.y);
      if (added) { commit({ ...value, items: [...value.items, added] }); setSelected(added.id); }
      return;
    }
    setSelected(it.id);
    drag.current = { id: it.id, sx: p.x, sy: p.y, orig: it, moved: false };
    svg.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = point(e);
    if (draft && draft.t === "arrow") return setDraft({ ...draft, x2: p.x, y2: p.y });
    const d = drag.current;
    if (!d) return;
    const dx = round(p.x - d.sx), dy = round(p.y - d.sy);
    if (!d.moved && Math.hypot(dx, dy) < 0.4) return;
    if (!d.moved) setHistory((hs) => [...hs.slice(-49), value]);
    d.moved = true;
    const o = d.orig;
    const moved: DiagramItem = o.t === "arrow"
      ? { ...o, x: round(o.x + dx), y: round(o.y + dy), x2: round(o.x2 + dx), y2: round(o.y2 + dy) }
      : { ...o, x: round(o.x + dx), y: round(o.y + dy) };
    onChange({ ...value, items: value.items.map((i) => (i.id === d.id ? moved : i)) });
  };

  const onUp = () => {
    if (draft && draft.t === "arrow") {
      if (Math.hypot(draft.x2 - draft.x, draft.y2 - draft.y) >= 1.5) {
        commit({ ...value, items: [...value.items, draft] });
        setSelected(draft.id);
      }
      setDraft(null);
    }
    drag.current = null;
  };

  const remove = () => {
    if (!selected) return;
    commit({ ...value, items: value.items.filter((i) => i.id !== selected) });
    setSelected(null);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    onChange(prev);
    setSelected(null);
  };
  const rotate = () => {
    commit({ ...value, items: value.items.map((i) => (i.id === selected && i.t === "goal" ? { ...i, r: ((i.r + 90) % 360) as 0 | 90 | 180 | 270 } : i)) });
  };
  const setPitch = (pitch: PitchKind) => {
    const b = PITCHES[pitch];
    const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
    commit({
      pitch,
      items: value.items.map((i) => (i.t === "arrow"
        ? { ...i, x: clamp(i.x, b.w), y: clamp(i.y, b.h), x2: clamp(i.x2, b.w), y2: clamp(i.y2, b.h) }
        : { ...i, x: clamp(i.x, b.w), y: clamp(i.y, b.h) })),
    });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); remove(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    const step = e.shiftKey ? 2 : 0.5;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (delta && selected) {
      e.preventDefault();
      const [dx, dy] = delta;
      commit({ ...value, items: value.items.map((i) => (i.id !== selected ? i : i.t === "arrow"
        ? { ...i, x: round(i.x + dx), y: round(i.y + dy), x2: round(i.x2 + dx), y2: round(i.y2 + dy) }
        : { ...i, x: round(i.x + dx), y: round(i.y + dy) })) });
    }
  };

  const sel = value.items.find((i) => i.id === selected);
  const shown: Diagram = draft ? { ...value, items: [...value.items, draft] } : value;
  const c = diagramCounts(value);

  return (
    <div className="space-y-3" onKeyDown={onKey}>
      <Segmented label={t.pitch} value={value.pitch} onChange={setPitch}
        options={(["full", "half", "area"] as const).map((p) => ({ value: p, label: t.pitches[p] }))} />

      <div role="toolbar" aria-label={t.toolbar} className="flex flex-wrap items-center gap-1 rounded-[0.75rem] bg-sunken p-1">
        {(["select", ...PLACE, ...ARROWS] as Tool[]).map((k) => (
          <button key={k} type="button" aria-pressed={tool === k} title={t.tools[k]} aria-label={t.tools[k]}
            onClick={() => setTool(k)}
            className={cn("inline-flex size-10 items-center justify-center rounded-[0.5rem] text-ink-2 transition-colors",
              tool === k ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "hover:text-ink")}>
            <ToolIcon tool={k} />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-line-strong max-sm:hidden" aria-hidden />
        <IconButton label={t.undo} onClick={undo} disabled={!history.length} className="size-10"><Undo2 className="size-5" aria-hidden /></IconButton>
        <IconButton label={t.remove} onClick={remove} disabled={!sel} className="size-10"><Trash2 className="size-5" aria-hidden /></IconButton>
        {sel?.t === "goal" ? <IconButton label={t.rotate} onClick={rotate} className="size-10"><RotateCw className="size-5" aria-hidden /></IconButton> : null}
        <IconButton label={t.clear} disabled={!value.items.length} className="size-10"
          onClick={() => { commit({ ...value, items: [] }); setSelected(null); }}>
          <Eraser className="size-5" aria-hidden />
        </IconButton>
      </div>
      <p className="text-sm text-ink-3">{t.tools[tool]}</p>

      <div tabIndex={0} className="overflow-hidden rounded-[var(--radius-control)] focus-visible:outline-offset-2">
        <PitchSvg
          svgRef={svg}
          uid="editor"
          diagram={shown}
          label={value.items.length ? t.summary(c.players, c.others, c.arrows) : t.empty}
          selectedId={selected}
          onItemPointerDown={onItem}
          onPointerDown={onBackground}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="mx-auto block max-h-[70vh] w-full touch-none select-none"
          style={{ cursor: tool === "select" ? "default" : "crosshair" }}
        />
      </div>
    </div>
  );
}
