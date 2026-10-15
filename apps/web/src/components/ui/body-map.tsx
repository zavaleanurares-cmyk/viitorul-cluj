"use client";
import { BODY_ZONES, zoneIsSided, zoneLabel, type BodySide, type BodyView, type BodyZoneCode, type StatusTone } from "@club/shared";
import { cn } from "@/lib/cn";
import { TONE_HEX } from "./status";
import { Select } from "./form";

/**
 * Harta corpului, desenată din cod (SVG): față și spate, stânga / dreapta.
 * Coordonatele sunt într-un cadru de 200 × 410. În vederea din față, stânga jucătorului
 * este în dreapta imaginii; în vederea din spate, în stânga imaginii.
 */
type Shape =
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number };

type Region = { zone: BodyZoneCode; view: BodyView; side: BodySide | null; shape: Shape };

const C = 100; // axa de simetrie

/** O formă pe o parte a corpului + oglindita ei. `dx` = distanța față de axă a centrului formei. */
function pair(zone: BodyZoneCode, view: BodyView, make: (cx: number) => Shape, dx: number): Region[] {
  // în imagine: x < 100 este partea DREAPTĂ a jucătorului văzut din față și partea STÂNGĂ văzut din spate
  const imageLeft: BodySide = view === "front" ? "right" : "left";
  const imageRight: BodySide = view === "front" ? "left" : "right";
  return [
    { zone, view, side: imageLeft, shape: make(C - dx) },
    { zone, view, side: imageRight, shape: make(C + dx) },
  ];
}
const el = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: "ellipse", cx, cy, rx, ry });
const rc = (cx: number, y: number, w: number, h: number, r: number): Shape => ({ t: "rect", x: cx - w / 2, y, w, h, r });

function buildRegions(view: BodyView): Region[] {
  const both = (zone: BodyZoneCode, shape: Shape): Region => ({ zone, view, side: null, shape });
  const arms: Region[] = [
    ...pair("shoulder", view, (cx) => el(cx, 80, 15, 13), 37),
    ...pair("upper_arm", view, (cx) => rc(cx, 92, 17, 48, 8), 47),
    ...pair("elbow", view, (cx) => el(cx, 147, 9.5, 8.5), 49),
    ...pair("forearm", view, (cx) => rc(cx, 155, 15, 44, 7), 51),
    ...pair("hand", view, (cx) => el(cx, 211, 9, 12), 53),
  ];
  if (view === "front") {
    return [
      both("head", el(C, 30, 19, 23)),
      both("neck", rc(C, 52, 20, 14, 4)),
      both("chest", rc(C, 68, 58, 46, 9)),
      both("abdomen", rc(C, 116, 54, 44, 9)),
      ...arms,
      ...pair("hip", view, (cx) => el(cx, 168, 12, 9), 25),
      ...pair("thigh_front", view, (cx) => rc(cx, 180, 27, 72, 12), 20),
      ...pair("groin", view, (cx) => el(cx, 186, 8, 12), 7),
      ...pair("knee", view, (cx) => el(cx, 263, 13, 11.5), 20),
      ...pair("shin", view, (cx) => rc(cx, 276, 21, 74, 9), 20),
      ...pair("ankle", view, (cx) => el(cx, 358, 10, 7.5), 20),
      ...pair("foot", view, (cx) => el(cx, 380, 12, 14), 22),
    ];
  }
  return [
    both("head", el(C, 30, 19, 23)),
    both("neck", rc(C, 52, 20, 14, 4)),
    both("upper_back", rc(C, 68, 58, 46, 9)),
    both("lower_back", rc(C, 116, 52, 32, 8)),
    ...arms,
    ...pair("hip", view, (cx) => el(cx, 158, 8, 9), 33),
    ...pair("glute", view, (cx) => el(cx, 168, 16, 16), 14),
    ...pair("thigh_back", view, (cx) => rc(cx, 186, 27, 66, 12), 20),
    ...pair("knee", view, (cx) => el(cx, 263, 13, 11.5), 20),
    ...pair("calf", view, (cx) => rc(cx, 276, 23, 56, 10), 20),
    ...pair("achilles", view, (cx) => rc(cx, 334, 10, 18, 5), 20),
    ...pair("ankle", view, (cx) => el(cx, 360, 10, 7.5), 20),
    ...pair("foot", view, (cx) => el(cx, 382, 11, 12), 21),
  ];
}

const REGIONS: Record<BodyView, Region[]> = { front: buildRegions("front"), back: buildRegions("back") };

export type BodySelection = { zone: BodyZoneCode; side: BodySide | null };
export type BodyHighlight = { zone: string | null; side?: string | null; tone?: StatusTone; label?: string };

function matches(r: Region, zone: string | null | undefined, side: string | null | undefined) {
  if (!zone || r.zone !== zone) return false;
  if (r.side === null || !side || side === "both") return true;
  return r.side === side;
}

function Figure({ view, value, highlights, onPick, interactive }: {
  view: BodyView; value: BodySelection | null; highlights: BodyHighlight[]; onPick?: (r: Region) => void; interactive: boolean;
}) {
  return (
    <figure className="flex-1">
      <svg viewBox="0 0 200 400" role="group" aria-label={view === "front" ? "Vedere din față" : "Vedere din spate"} className="mx-auto h-auto w-full max-w-[13rem] touch-manipulation">
        {REGIONS[view].map((r, i) => {
          const selected = !!value && matches(r, value.zone, value.side);
          const hl = highlights.find((h) => matches(r, h.zone, h.side));
          const fill = selected ? "var(--color-brand)" : hl ? TONE_HEX[hl.tone ?? "red"] : "#e3e8ed";
          const stroke = selected ? "var(--color-ink)" : hl ? "var(--color-ink)" : "#d2d2d7";
          const label = zoneLabel(r.zone, r.side);
          const common = {
            fill,
            stroke,
            strokeWidth: selected || hl ? 2 : 1,
            className: cn(interactive && "cursor-pointer outline-offset-1 hover:brightness-95"),
            ...(interactive
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  "aria-label": label,
                  "aria-pressed": selected,
                  onClick: () => onPick?.(r),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick?.(r);
                    }
                  },
                }
              : {}),
          };
          return r.shape.t === "ellipse" ? (
            <ellipse key={i} cx={r.shape.cx} cy={r.shape.cy} rx={r.shape.rx} ry={r.shape.ry} {...common}>
              <title>{hl?.label ?? label}</title>
            </ellipse>
          ) : (
            <rect key={i} x={r.shape.x} y={r.shape.y} width={r.shape.w} height={r.shape.h} rx={r.shape.r} {...common}>
              <title>{hl?.label ?? label}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-center text-sm font-semibold text-ink-2">
        {view === "front" ? "Față" : "Spate"}
        <span className="block text-xs font-normal text-ink-3">
          {view === "front" ? "dreapta jucătorului ◂ ▸ stânga" : "stânga jucătorului ◂ ▸ dreapta"}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Selectare de zonă (cu `onChange`) sau afișare (fără): `highlights` colorează zonele accidentate.
 * Sub siluetă există mereu și lista de zone, pentru cine preferă să aleagă din text.
 */
export function BodyMap({ value = null, onChange, highlights = [], showList = true, className }: {
  value?: BodySelection | null;
  onChange?: (v: BodySelection | null) => void;
  highlights?: BodyHighlight[];
  showList?: boolean;
  className?: string;
}) {
  const interactive = !!onChange;
  const pick = (r: Region) => {
    if (!onChange) return;
    if (value && matches(r, value.zone, value.side) && (r.side === null || value.side === r.side)) onChange(null);
    else onChange({ zone: r.zone, side: r.side });
  };
  return (
    <div className={className}>
      <div className="flex gap-2">
        <Figure view="front" value={value} highlights={highlights} onPick={pick} interactive={interactive} />
        <Figure view="back" value={value} highlights={highlights} onPick={pick} interactive={interactive} />
      </div>
      {interactive && showList ? (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Select
            aria-label="Zonă"
            value={value?.zone ?? ""}
            onChange={(e) => {
              const zone = e.target.value as BodyZoneCode | "";
              if (!zone) return onChange?.(null);
              onChange?.({ zone, side: zoneIsSided(zone) ? value?.side ?? null : null });
            }}
          >
            <option value="">Nicio zonă</option>
            {BODY_ZONES.map((z) => (
              <option key={z.code} value={z.code}>
                {z.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Parte"
            value={value?.side ?? ""}
            disabled={!value || !zoneIsSided(value.zone)}
            onChange={(e) => value && onChange?.({ zone: value.zone, side: (e.target.value || null) as BodySide | null })}
          >
            <option value="">Parte</option>
            <option value="left">Stânga</option>
            <option value="right">Dreapta</option>
            <option value="both">Bilateral</option>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
