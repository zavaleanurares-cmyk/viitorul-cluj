import { norm } from "./text";

/** Zonele corpului folosite peste tot: stare, accidentări, chestionar, exerciții. */
export const BODY_ZONES = [
  { code: "head", label: "Cap", sided: false, views: ["front", "back"] },
  { code: "neck", label: "Gât / cervical", sided: false, views: ["front", "back"] },
  { code: "shoulder", label: "Umăr", sided: true, views: ["front", "back"] },
  { code: "upper_arm", label: "Braț", sided: true, views: ["front", "back"] },
  { code: "elbow", label: "Cot", sided: true, views: ["front", "back"] },
  { code: "forearm", label: "Antebraț", sided: true, views: ["front", "back"] },
  { code: "hand", label: "Mână / încheietură", sided: true, views: ["front", "back"] },
  { code: "chest", label: "Piept / coaste", sided: false, views: ["front"] },
  { code: "abdomen", label: "Abdomen", sided: false, views: ["front"] },
  { code: "upper_back", label: "Spate superior", sided: false, views: ["back"] },
  { code: "lower_back", label: "Zona lombară", sided: false, views: ["back"] },
  { code: "hip", label: "Șold", sided: true, views: ["front", "back"] },
  { code: "groin", label: "Adductori / zona inghinală", sided: true, views: ["front"] },
  { code: "glute", label: "Fesier", sided: true, views: ["back"] },
  { code: "thigh_front", label: "Coapsă anterioară (cvadriceps)", sided: true, views: ["front"] },
  { code: "thigh_back", label: "Coapsă posterioară (ischiogambieri)", sided: true, views: ["back"] },
  { code: "knee", label: "Genunchi", sided: true, views: ["front", "back"] },
  { code: "shin", label: "Tibie", sided: true, views: ["front"] },
  { code: "calf", label: "Gambă", sided: true, views: ["back"] },
  { code: "ankle", label: "Gleznă", sided: true, views: ["front", "back"] },
  { code: "achilles", label: "Tendon ahilean", sided: true, views: ["back"] },
  { code: "foot", label: "Laba piciorului", sided: true, views: ["front", "back"] },
] as const;

export type BodyZoneCode = (typeof BODY_ZONES)[number]["code"];
export type BodySide = "left" | "right" | "both";
export type BodyView = "front" | "back";

export const SHORT_ZONE_LABELS: Record<BodyZoneCode, string> = {
  head: "Cap", neck: "Gât", shoulder: "Umăr", upper_arm: "Braț", elbow: "Cot", forearm: "Antebraț",
  hand: "Mână", chest: "Piept", abdomen: "Abdomen", upper_back: "Spate sus", lower_back: "Lombar",
  hip: "Șold", groin: "Adductori", glute: "Fesier", thigh_front: "Cvadriceps", thigh_back: "Ischiogambieri",
  knee: "Genunchi", shin: "Tibie", calf: "Gambă", ankle: "Gleznă", achilles: "Ahilean", foot: "Labă",
};

export const SIDE_LABELS: Record<BodySide, string> = { left: "stânga", right: "dreapta", both: "bilateral" };

const ZONE_BY_CODE = new Map<string, (typeof BODY_ZONES)[number]>(BODY_ZONES.map((z) => [z.code, z]));

export function isBodyZone(code: unknown): code is BodyZoneCode {
  return typeof code === "string" && ZONE_BY_CODE.has(code);
}

export function zoneLabel(code: string | null | undefined, side?: string | null, short = false): string {
  if (!code) return "";
  const z = ZONE_BY_CODE.get(code);
  if (!z) return code;
  const base = short ? SHORT_ZONE_LABELS[z.code] : z.label;
  return side && z.sided && side in SIDE_LABELS ? `${base}, ${SIDE_LABELS[side as BodySide]}` : base;
}

export function zoneIsSided(code: string | null | undefined): boolean {
  return !!code && !!ZONE_BY_CODE.get(code)?.sided;
}

/** Afișare completă: „Genunchi, stânga — ligament (de confirmat)". */
export function describeZone(z: {
  zone?: string | null; side?: string | null; detail?: string | null; uncertain?: boolean | null;
}, short = false): string {
  const parts = [zoneLabel(z.zone, z.side, short), z.detail?.trim()].filter(Boolean);
  let text = parts.join(" — ");
  if (z.uncertain && text) text += " (de confirmat)";
  return text;
}

// Sinonime întâlnite în tabelele cluburilor (română + engleză). Ordinea contează: primul găsit câștigă.
const ZONE_SYNONYMS: Array<[RegExp, BodyZoneCode, string?]> = [
  [/\b(HAMSTRING\w*|ISCHIO\w*|BICEPS FEMURAL)\b/, "thigh_back"],
  [/\b(CVADRICEPS|QUADRICEPS|QUAD)\b/, "thigh_front"],
  [/\b(ADDUCTOR\w*|ADUCTOR\w*|INGHINAL\w*|GROIN|PUBALGIE)\b/, "groin"],
  [/\b(AHILE\w*|ACHILLES|ACHILEAN|AHILEAN)\b/, "achilles"],
  [/\b(METATARS\w*)\b/, "foot", "metatarsiene"],
  [/\b(GENUNCHI\w*|KNEE|MENISC\w*|ROTUL\w*|LIA|LCA|ACL)\b/, "knee"],
  [/\b(GLEZN\w*|ANKLE)\b/, "ankle"],
  [/\b(GAMB\w*|CALF|MOLET\w*|SOLEAR\w*)\b/, "calf"],
  [/\b(TIBI\w*|SHIN)\b/, "shin"],
  [/\b(UMAR\w*|SHOULDER|CLAVICUL\w*)\b/, "shoulder"],
  [/\b(SOLD\w*|HIP)\b/, "hip"],
  [/\b(FESIER\w*|GLUTE\w*)\b/, "glute"],
  [/\b(LOMBAR\w*|LUMBAR|SPATE|BACK)\b/, "lower_back"],
  [/\b(CERVICAL\w*|GAT|GATUL|NECK)\b/, "neck"],
  [/\b(COT|COTUL|ELBOW)\b/, "elbow"],
  [/\b(ANTEBRAT\w*|FOREARM)\b/, "forearm"],
  [/\b(INCHEIETUR\w*|MANA|MAINII|HAND|WRIST|DEGET\w* MAN\w*)\b/, "hand"],
  [/\b(BRAT\w*)\b/, "upper_arm"],
  [/\b(PIEPT\w*|COAST\w*|TORACE|CHEST|RIB\w*)\b/, "chest"],
  [/\b(ABDOMEN\w*|ABDOMINAL\w*)\b/, "abdomen"],
  [/\b(CAP|CAPUL|HEAD|COMOTIE|NAS|NASUL|FATA)\b/, "head"],
  [/\b(COAPS\w*|THIGH)\b/, "thigh_front"],
  [/\b(LABA|TALPA|CALCAI\w*|FOOT|DEGET\w*|HALUCE)\b/, "foot"],
  [/\b(PICIOR\w*)\b/, "foot"],
];

export type ParsedZone = {
  zone: BodyZoneCode | null;
  side: BodySide | null;
  detail: string | null;
  uncertain: boolean;
  /** valoare numerică rătăcită în câmpul de zonă (ex. „5/10") */
  misplacedValue: string | null;
  flagged: boolean;
  reason: string | null;
};

const EMPTY_ZONE: ParsedZone = {
  zone: null, side: null, detail: null, uncertain: false, misplacedValue: null, flagged: false, reason: null,
};

/** Interpretează textul liber dintr-o coloană de „zonă accidentare" / „zonă dureroasă". */
export function parseZoneText(input: unknown): ParsedZone {
  const original = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!original || /^[-–—.]+$/.test(original)) return { ...EMPTY_ZONE };

  if (/^\d+([.,]\d+)?(\s*\/\s*\d+)?$/.test(original)) {
    return { ...EMPTY_ZONE, misplacedValue: original, flagged: true, reason: `Valoare numerică în câmpul de zonă: „${original}"` };
  }

  const uncertain = original.includes("?");
  const n = norm(original);
  let side: BodySide | null = null;
  if (/\b(STANG\w*|STG|STA|LEFT)\b/.test(n)) side = "left";
  else if (/\b(DREPT\w*|DREAPTA|DR|RIGHT)\b/.test(n)) side = "right";
  else if (/\b(BILATERAL\w*|AMBELE|AMBII)\b/.test(n)) side = "both";

  const hits: Array<{ zone: BodyZoneCode; detail?: string; at: number }> = [];
  for (const [re, zone, detail] of ZONE_SYNONYMS) {
    const m = re.exec(n);
    if (m && !hits.some((h) => h.zone === zone)) hits.push({ zone, detail, at: m.index });
  }
  hits.sort((a, b) => a.at - b.at);

  // textul fără prefixul „acc." / „accidentare"
  const cleaned = original.replace(/^\s*acc(identare|\.)?\s*\.?\s*/i, "").replace(/\?/g, "").trim();

  if (!hits.length) {
    return {
      ...EMPTY_ZONE, side, detail: cleaned || original, uncertain, flagged: true,
      reason: `Zonă nerecunoscută: „${original}"`,
    };
  }
  const first = hits[0];
  const ambiguous = hits.length > 1;
  const cleanedNorm = norm(cleaned);
  // dacă textul spune doar zona, nu mai repetăm în detaliu
  const zoneOnly = !ambiguous && !first.detail && cleanedNorm.split(" ").length === 1;
  const vague = /\b(PICIOR\w*|COAPS\w*)\b/.test(n) && !ambiguous;
  return {
    zone: first.zone,
    side,
    detail: ambiguous ? original : first.detail ?? (zoneOnly ? null : cleaned),
    uncertain: uncertain || ambiguous,
    misplacedValue: null,
    flagged: uncertain || ambiguous || vague,
    reason: ambiguous
      ? `Mai multe zone posibile: „${original}"`
      : uncertain ? `Zonă incertă în tabel: „${original}"`
      : vague ? `Zonă imprecisă: „${original}"` : null,
  };
}
