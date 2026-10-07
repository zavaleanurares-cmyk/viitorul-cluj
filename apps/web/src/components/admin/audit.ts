import {
  AUDIT_ACTIONS, AUDIT_ENTITIES, AVAILABILITY_LABELS, FEET, INJURY_CONTACT, INJURY_CONTEXT, INJURY_SEVERITY, INJURY_TYPES, POSITIONS, ROLE_LABELS, SIDE_LABELS,
  addDays, formatDateShort, formatDateTime, label, zoneLabel, type Db, type Tables,
} from "@club/shared";
import { getT } from "@/messages";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 20000;

/** Acțiunile și entitățile din jurnal: cele din pachetul comun + cele scrise de modulul de administrare. */
export function auditActions(): Record<string, string> {
  return { ...AUDIT_ACTIONS, ...getT().admin.audit.extraActions };
}
export function auditEntities(): Record<string, string> {
  return { ...AUDIT_ENTITIES, ...getT().admin.audit.extraEntities };
}

export type AuditFilters = { de?: string; pana?: string; utilizator?: string; jucator?: string; actiune?: string; entitate?: string };
type Raw = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAuditFilters(sp: Raw): AuditFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f: AuditFilters = {};
  if (DATE.test(s("de"))) f.de = s("de");
  if (DATE.test(s("pana"))) f.pana = s("pana");
  if (UUID.test(s("utilizator")) || s("utilizator") === "sistem") f.utilizator = s("utilizator");
  if (UUID.test(s("jucator"))) f.jucator = s("jucator");
  if (s("actiune") in auditActions()) f.actiune = s("actiune");
  if (/^[a-z_]{2,40}$/.test(s("entitate"))) f.entitate = s("entitate");
  return f;
}

export function auditQueryString(f: AuditFilters, extra: Record<string, string | number | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Momentul (UTC) la care începe o zi calendaristică în fusul orar al clubului. */
export function zonedDayStart(date: string, timeZone: string): string {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess - (local - guess)).toISOString();
}

export type AuditRow = Tables<"audit_log">;

/** Jurnalul filtrat, cele mai noi intrări întâi. RLS întoarce doar jurnalul clubului preparatorului. */
export async function fetchAudit(db: Db, f: AuditFilters, timeZone: string, from: number, to: number): Promise<{ rows: AuditRow[]; total: number }> {
  let q = db.from("audit_log").select("*", { count: "exact" });
  if (f.de) q = q.gte("created_at", zonedDayStart(f.de, timeZone));
  if (f.pana) q = q.lt("created_at", zonedDayStart(addDays(f.pana, 1), timeZone));
  if (f.utilizator === "sistem") q = q.is("actor_id", null);
  else if (f.utilizator) q = q.eq("actor_id", f.utilizator);
  if (f.jucator) q = q.eq("player_id", f.jucator);
  if (f.actiune) q = q.eq("action", f.actiune);
  if (f.entitate) q = q.eq("entity", f.entitate);
  const { data, error, count } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export type AuditLookups = {
  profiles: Map<string, { name: string; role: string }>;
  players: Map<string, string>;
  groups: Map<string, string>;
  statuses: Map<string, string>;
  timeZone: string;
};

export async function loadAuditLookups(db: Db, ctx: { groups: Array<{ id: string; name: string }>; statuses: Array<{ id: string; label: string }>; settings: { timezone: string } }): Promise<AuditLookups> {
  const [profiles, players] = await Promise.all([
    db.from("profiles").select("id, full_name, role"),
    db.from("players").select("id, display_name"),
  ]);
  return {
    profiles: new Map((profiles.data ?? []).map((p) => [p.id, { name: p.full_name, role: p.role }])),
    players: new Map((players.data ?? []).map((p) => [p.id, p.display_name])),
    groups: new Map(ctx.groups.map((g) => [g.id, g.name])),
    statuses: new Map(ctx.statuses.map((s) => [s.id, s.label])),
    timeZone: ctx.settings.timezone,
  };
}

// câmpuri tehnice, fără înțeles pentru cine citește jurnalul
const HIDDEN = new Set(["id", "club_id", "created_at", "updated_at", "status_updated_at", "raw", "file_hash", "mapping", "report", "import_id", "slug", "load", "dedupe_key"]);
const USER_FIELDS = new Set(["user_id", "partner_user_id", "created_by", "handled_by", "uploaded_by", "recorded_by", "changed_by", "author_id", "resolved_by"]);
const ZONE_FIELDS = new Set(["zone", "status_zone", "pain_zone"]);
const CODED: Record<string, Record<string, string>> = {
  role: ROLE_LABELS, availability: AVAILABILITY_LABELS, position: POSITIONS, dominant_foot: FEET,
  injury_type: INJURY_TYPES, contact: INJURY_CONTACT, context: INJURY_CONTEXT, severity: INJURY_SEVERITY,
};

function fieldLabel(key: string): string {
  const fields: Record<string, string> = getT().admin.audit.fields;
  return fields[key] ?? key.replace(/_/g, " ");
}

function formatValue(key: string, value: unknown, l: AuditLookups): string {
  const t = getT().admin.audit;
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (typeof value === "number") return String(value).replace(".", ",");
  if (typeof value === "string") {
    if (key === "status_id") return l.statuses.get(value) ?? t.unknownRef;
    if (key === "group_id") return l.groups.get(value) ?? t.unknownRef;
    if (key === "player_id") return l.players.get(value) ?? t.deletedPlayer;
    if (USER_FIELDS.has(key)) return l.profiles.get(value)?.name ?? t.deletedAccount;
    if (key.endsWith("_id")) return t.otherRecord;
    if (key.endsWith("_path")) return t.file;
    if (key === "path") return value.split("/").pop() ?? t.file;
    if (ZONE_FIELDS.has(key)) return zoneLabel(value);
    if (key in CODED) return label(CODED[key], value);
    if (key === "side" || key.endsWith("_side")) return label(SIDE_LABELS, value);
    if (key === "source") return (t.sources as Record<string, string>)[value] ?? value;
    if (key === "tone") return (t.tones as Record<string, string>)[value] ?? value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateShort(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value, l.timeZone);
    return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  }
  if (Array.isArray(value)) return value.length ? value.map((v) => formatValue("", v, l)).join(", ") : "—";
  const json = JSON.stringify(value);
  return json.length > 90 ? `${json.slice(0, 90)}…` : json;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export type AuditLine = { label: string; from?: string; to?: string; value?: string };

/** Schimbările dintr-un obiect JSON (setări, întrebări suplimentare), cheie cu cheie. */
function diffObject(prefix: string, before: Record<string, unknown>, after: Record<string, unknown>, l: AuditLookups, out: AuditLine[]) {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (isObject(a) && isObject(b)) diffObject(`${prefix} › ${fieldLabel(key)}`, a, b, l, out);
    else out.push({ label: `${prefix} › ${fieldLabel(key)}`, from: formatValue(key, a, l), to: formatValue(key, b, l) });
  }
}

/** Detaliile unei intrări, pe înțelesul celui care citește: câmp, valoare veche → valoare nouă. */
export function describeDetails(row: Pick<AuditRow, "action" | "details" | "entity" | "entity_id">, l: AuditLookups): AuditLine[] {
  const t = getT().admin.audit;
  // la conturi și la grupele staffului, spune despre al cui cont este vorba
  const subject: AuditLine[] =
    (row.entity === "profiles" || row.entity === "staff_groups") && row.entity_id
      ? [{ label: fieldLabel("user_id"), value: l.profiles.get(row.entity_id)?.name ?? t.deletedAccount }]
      : [];
  return [...subject, ...describeChanges(row, l)];
}

function describeChanges(row: Pick<AuditRow, "action" | "details">, l: AuditLookups): AuditLine[] {
  const t = getT().admin.audit;
  const d = row.details;
  if (!isObject(d)) return [];
  if (d.redacted === true) {
    const fields = Array.isArray(d.fields) ? (d.fields as unknown[]).filter((k): k is string => typeof k === "string" && !HIDDEN.has(k)) : [];
    return [{ label: t.redacted, value: fields.length ? fields.map(fieldLabel).join(", ") : undefined }];
  }
  const out: AuditLine[] = [];
  if (row.action === "UPDATE") {
    for (const [key, change] of Object.entries(d)) {
      if (HIDDEN.has(key) || !isObject(change)) continue;
      const before = change.old;
      const after = change.new;
      if (isObject(before) && isObject(after)) diffObject(fieldLabel(key), before, after, l, out);
      else out.push({ label: fieldLabel(key), from: formatValue(key, before, l), to: formatValue(key, after, l) });
    }
    return out;
  }
  if (row.action === "DELETE" && isObject(d.deleted)) {
    for (const [key, value] of Object.entries(d.deleted)) {
      if (HIDDEN.has(key) || value === null || value === "" || value === false || isObject(value)) continue;
      if (Array.isArray(value) && !value.length) continue;
      out.push({ label: fieldLabel(key), value: formatValue(key, value, l) });
    }
    return out.slice(0, 8);
  }
  for (const [key, value] of Object.entries(d)) {
    if (HIDDEN.has(key) || key === "player_id" || value === null) continue;
    out.push({ label: fieldLabel(key), value: formatValue(key, value, l) });
  }
  return out;
}

export function lineText(line: AuditLine): string {
  if (line.from !== undefined || line.to !== undefined) return `${line.label}: ${line.from} → ${line.to}`;
  return line.value ? `${line.label}: ${line.value}` : line.label;
}
