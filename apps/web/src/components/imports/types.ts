import type { IMPORT_KINDS, NameDecision, Sheet, Tables } from "@club/shared";

export type ImportKind = keyof typeof IMPORT_KINDS;

/** Tipul de import din adresă (`/import?tip=fizic`) -> valoarea din tabelul `imports`. */
export const KIND_BY_SLUG = {
  sanatate: "health_status",
  chestionar: "fatigue_grid",
  lista: "roster",
  fizic: "physical",
  teste: "tests",
} as const satisfies Record<string, ImportKind>;
export type KindSlug = keyof typeof KIND_BY_SLUG;
export const KIND_SLUGS = Object.keys(KIND_BY_SLUG) as KindSlug[];
export const SLUG_BY_KIND = Object.fromEntries(Object.entries(KIND_BY_SLUG).map(([s, k]) => [k, s])) as Record<ImportKind, KindSlug>;

export function isKindSlug(value: unknown): value is KindSlug {
  return typeof value === "string" && value in KIND_BY_SLUG;
}

export type ImportGroup = Pick<Tables<"groups">, "id" | "name" | "sort">;
export type ImportStatus = Pick<Tables<"club_statuses">, "code" | "label" | "short_label" | "tone" | "icon">;
export type ImportPlayer = Pick<Tables<"players">, "id" | "display_name" | "full_name" | "group_id">;
export type ImportTest = Pick<Tables<"fitness_tests">, "id" | "code" | "name" | "unit">;
export type ImportTemplate = { id: string; name: string; mapping: TemplateMapping };
export type KnownFile = { file_hash: string; kind: ImportKind; filename: string | null; created_at: string };

/** Tot ce are nevoie asistentul de import din baza de date (încărcat pe server, sub RLS). */
export type ImportContext = {
  today: string;
  timezone: string;
  groups: ImportGroup[];
  statuses: ImportStatus[];
  players: ImportPlayer[];
  remembered: Array<{ source_name: string; group_id: string | null; player_id: string }>;
  tests: ImportTest[];
  templates: ImportTemplate[];
  knownFiles: KnownFile[];
};

/** Șablon de mapare salvat: legat de textul antetelor, nu de poziția coloanelor. */
export type TemplateMapping = {
  version: 1;
  /** antetele fișierului din care a fost salvat șablonul (normalizate, în ordine) */
  headers: string[];
  /** cheia coloanei (antet normalizat + a câta apariție) -> câmp, `extra:<antet>` sau "" */
  columns: Record<string, string>;
  defaults: { session_type: "training" | "match" | "test" | "other"; source: "ksport" | "import" };
};

export type LoadedSheet = { name: string; data: Sheet; hash: string };
export type LoadedFile = { filename: string; sheets: LoadedSheet[] };

/** Un nume distinct din fișier, care trebuie legat de un jucător din evidență. */
export type NameItem = {
  /** `decisionKey(name, keyGroupId)` — cheia sub care se ține decizia */
  key: string;
  name: string;
  keyGroupId: string | null;
  /** grupa folosită ca indiciu la propunerea potrivirilor */
  hintGroupId: string | null;
  rows: number;
  /** are valori de importat (la grila săptămânală unii jucători au rândul gol) */
  hasData: boolean;
  allowCreate: boolean;
  /** fără niciun candidat, numele devine jucător nou fără să mai ceară o decizie */
  autoCreate: boolean;
};

export type Decisions = Record<string, NameDecision>;

export type Annotation = {
  row: number;
  name: string;
  note: string;
  /** cu rezultat = rând în plus în raport (nu a ajuns la import); fără = observație pe un rând importat */
  result?: "skipped" | "error";
};

export type SummaryStat = { label: string; value: number; tone?: "green" | "orange" | "red" | "gray" };

export type BuiltImport = {
  payload: unknown;
  annotations: Annotation[];
  stats: SummaryStat[];
  /** rânduri care se importă, dar rămân marcate „de verificat" */
  flagged: Array<{ row: number; name: string; note: string }>;
  /** câte rânduri ajung efectiv în baza de date; 0 = nu are rost să continui */
  importable: number;
};

/** Rezultatul pasului de mapare: numele de potrivit și funcția care construiește datele de trimis. */
export type Prepared = {
  names: NameItem[];
  build: (decisions: Decisions) => BuiltImport;
};

export type ReportRow = {
  row: number | null;
  name: string | null;
  date?: string | null;
  result: "created" | "updated" | "imported" | "skipped" | "error";
  flagged?: boolean;
  note?: string | null;
};

export type ImportRecord = {
  id: string;
  kind: ImportKind;
  filename: string | null;
  created_at: string;
  created_by_name: string | null;
  rows_imported: number;
  rows_skipped: number;
  rows_flagged: number;
  report: { rows: ReportRow[]; [key: string]: unknown };
};
