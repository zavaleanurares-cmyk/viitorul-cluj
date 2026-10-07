import { parseVideoUrl } from "@club/shared";

/** Exercițiul, cât îi trebuie unei liste sau selectorului (fără descriere și pași). */
export type ExerciseOption = {
  id: string;
  name: string;
  category: string;
  zones: string[];
  equipment: string[];
  level: string;
  image_url: string | null;
  has_video: boolean;
  is_active: boolean;
};

export const EXERCISE_OPTION_COLUMNS = "id, name, category, zones, equipment, level, image_url, video_url, video_path, is_active";

export function toExerciseOption(e: {
  id: string; name: string; category: string; zones: string[]; equipment: string[]; level: string;
  image_url: string | null; video_url: string | null; video_path: string | null; is_active: boolean;
}): ExerciseOption {
  return {
    id: e.id, name: e.name, category: e.category, zones: e.zones, equipment: e.equipment, level: e.level,
    image_url: e.image_url, has_video: !!e.video_path || !!parseVideoUrl(e.video_url), is_active: e.is_active,
  };
}

/** Rândul din baza de date al unui exercițiu de program sau de plan. */
export type ItemRow = {
  id: string;
  exercise_id: string;
  sort: number;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  rest_sec: number | null;
  tempo: string | null;
  notes: string | null;
};

/** Starea unui item în editor: câmpurile sunt text, cum le tastează preparatorul. */
export type ItemDraft = {
  key: string;
  id: string | null;
  exercise_id: string;
  sets: string;
  mode: "reps" | "time";
  reps: string;
  duration_sec: string;
  rest_sec: string;
  tempo: string;
  notes: string;
};

/** Forma trimisă către RPC-urile save_program / save_daily_plan. */
export type ItemPayload = {
  id: string | null;
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  rest_sec: number | null;
  tempo: string | null;
  notes: string | null;
};

export type ItemCompletion = { done: boolean; done_on: string; comment: string | null; pain: boolean; pain_intensity: number | null };

/** Jucătorul, cât îi trebuie dialogurilor de alocare și de copiere. */
export type PlayerOption = { id: string; name: string; group_id: string | null; position: string | null };
export type GroupOption = { id: string; name: string };

export type ProgramTemplate = { id: string; name: string; kind: string; is_template: boolean; items: ItemRow[] };

/** Valorile implicite ale unui exercițiu nou adăugat: 3 serii × 10 repetări, pauză 45 s. */
export const ITEM_DEFAULTS = { sets: "3", reps: "10", rest_sec: "45" } as const;

let counter = 0;
const nextKey = () => `k${++counter}`;

export function newItem(exerciseId: string): ItemDraft {
  return {
    key: nextKey(), id: null, exercise_id: exerciseId, sets: ITEM_DEFAULTS.sets, mode: "reps",
    reps: ITEM_DEFAULTS.reps, duration_sec: "", rest_sec: ITEM_DEFAULTS.rest_sec, tempo: "", notes: "",
  };
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** `keepId = false` când itemii sunt copiați în altă listă (dintr-un program în plan, la duplicare). */
export function itemFromRow(row: ItemRow, keepId = true): ItemDraft {
  return {
    key: keepId ? row.id : nextKey(),
    id: keepId ? row.id : null,
    exercise_id: row.exercise_id,
    sets: str(row.sets),
    mode: !row.reps && row.duration_sec ? "time" : "reps",
    reps: row.reps ?? "",
    duration_sec: str(row.duration_sec),
    rest_sec: str(row.rest_sec),
    tempo: row.tempo ?? "",
    notes: row.notes ?? "",
  };
}

const int = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export function itemToPayload(d: ItemDraft): ItemPayload {
  return {
    id: d.id,
    exercise_id: d.exercise_id,
    sets: int(d.sets),
    reps: d.mode === "reps" ? d.reps.trim() || null : null,
    duration_sec: d.mode === "time" ? int(d.duration_sec) : null,
    rest_sec: int(d.rest_sec),
    tempo: d.tempo.trim() || null,
    notes: d.notes.trim() || null,
  };
}

export type ItemProblem = "sets" | "duration" | "rest";

/** Verificarea din browser, înainte de salvare (serverul verifică din nou). */
export function itemProblem(d: ItemDraft): ItemProblem | null {
  const p = itemToPayload(d);
  const bad = (n: number | null, min: number, max: number) => n !== null && (!Number.isInteger(n) || n < min || n > max);
  if (bad(p.sets, 1, 30)) return "sets";
  if (bad(p.duration_sec, 1, 7200)) return "duration";
  if (bad(p.rest_sec, 0, 1800)) return "rest";
  return null;
}

export function sameItems(a: ItemDraft[], b: ItemDraft[]): boolean {
  return JSON.stringify(a.map(itemToPayload)) === JSON.stringify(b.map(itemToPayload));
}
