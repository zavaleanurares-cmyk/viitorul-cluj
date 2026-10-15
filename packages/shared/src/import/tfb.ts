import { norm, titleCase, tokens } from "../text";
import { proposeMatch, type MatchablePlayer } from "../matching";

/**
 * Migrarea din The Football Brain (TFB). Fișierele vin din TFB (exportul listei de jucători) și din
 * paginile TFB salvate ca CSV (echipe și staff, jucători pe echipe, utilizatorii aplicației, grila plăților
 * pe ani). Totul se citește în browser; serverul primește doar pachetul interpretat (`TfbBundle`),
 * construiește planul (`planTfbImport`) și îl scrie atomic prin `import_tfb`.
 */

export type CsvTable = string[][];

/** CSV cu ghilimele, separator „;" sau „," (ales după primul rând). */
export function parseCsv(text: string): CsvTable {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: CsvTable = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type TfbFileKind = "roster" | "player_teams" | "teams_staff" | "app_users" | "payments";

/** Recunoaște fișierul după antete (numele fișierului nu contează). */
export function detectTfbFile(rows: CsvTable): { kind: TfbFileKind; year?: number } | null {
  const head = (rows[0] ?? []).map((c) => norm(c));
  const has = (...h: string[]) => h.every((x) => head.includes(x));
  if (has("NUMELE SI PRENUMELE", "DATA NASTERII")) return { kind: "roster" };
  if (has("NUME", "POZITIE", "VARSTA NASTERE", "ECHIPE")) return { kind: "player_teams" };
  if (has("NUME", "RELATIE", "JUCATORI", "TELEFON", "EMAIL")) return { kind: "app_users" };
  if (has("AN", "NUME BLOC", "TAXA LUNARA")) {
    const year = Number(rows[1]?.[0]);
    return { kind: "payments", year: Number.isFinite(year) ? year : undefined };
  }
  if (head[0] === "0" && head.includes("NUME ECHIPA")) return { kind: "teams_staff" };
  return null;
}

export type TfbTeam = { name: string; season: string | null; type: string | null; coach: string | null; count: number | null; birthYear: number | null; gender: "m" | "f"; programme: string | null };
export type TfbStaff = { name: string; role: string; license: string | null };
export type TfbPlayer = {
  key: string; fullName: string; birthDate: string | null; teams: string[]; position: "GK" | "DEF" | "MID" | "FWD" | null; positionDetail: string | null;
  shirt: number | null; visaUntil: string | null; registration: string | null; registeredOn: string | null; enrolledOn: string | null;
  fee: number | null; matricol: string | null;
  /** în lista curentă de jucători (exportul TFB sau lista pe echipe); ceilalți apar doar în istoricul plăților */
  active: boolean;
};
export type TfbGuardian = { key: string; name: string; relation: "mother" | "father" | "guardian" | "parent"; phone: string | null; email: string | null; children: string[]; recurring: boolean };
export type TfbContact = { player: string; phone: string | null; email: string | null };
/** O lună din grila plăților: suma în bani; `method` doar dacă s-a plătit. */
export type TfbMonth = { player: string; period: string; amount: number; paid: boolean; method: TfbMethod | null; methodLabel: string | null };
export type TfbMethod = "online" | "bank" | "cash" | "card";

export type TfbBundle = {
  teams: TfbTeam[];
  staff: TfbStaff[];
  players: TfbPlayer[];
  guardians: TfbGuardian[];
  contacts: TfbContact[];
  months: TfbMonth[];
  years: number[];
  warnings: string[];
};

/** Cheia unui nume: cuvintele normalizate, în ordine alfabetică (TFB scrie același nume în ordini și forme diferite). */
export function tfbKey(name: string): string {
  return tokens(name).sort().join(" ");
}

function roDate(v: string | undefined | null): string | null {
  const m = String(v ?? "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  // Date.parse acceptă și 31.02; verificăm că ziua există
  const check = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  if (check.getUTCFullYear() !== Number(m[3]) || check.getUTCMonth() !== Number(m[2]) - 1 || check.getUTCDate() !== Number(m[1])) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function intOrNull(v: string | undefined | null): number | null {
  const n = Number(String(v ?? "").replace(/\s/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" && String(v).trim() !== "-" ? Math.round(n) : null;
}

/** Sumă în lei („1.234,50", „450", „450.5") → bani. */
export function leiToBani(v: string): number | null {
  let s = v.replace(/\s|lei/gi, "");
  if (!s || s === "-") return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const POSITIONS: Array<[RegExp, TfbPlayer["position"]]> = [
  [/^(GOALKEEPER|PORTAR)/, "GK"],
  [/^(DEFENDER|FUNDAS)/, "DEF"],
  [/^(MIDFIELDER|MIJLOCAS|EXTREMA)/, "MID"],
  [/^(FORWARD|ATACANT|VARF)/, "FWD"],
];
function position(raw: string): { code: TfbPlayer["position"]; detail: string | null } {
  const n = norm(raw);
  if (!n) return { code: null, detail: null };
  const code = POSITIONS.find(([re]) => re.test(n))?.[1] ?? null;
  const generic = /^(GOALKEEPER|DEFENDER|MIDFIELDER|FORWARD|PORTAR|FUNDAS|MIJLOCAS|ATACANT)$/.test(n);
  return { code, detail: code && !generic ? raw.trim() : null };
}

function teamMeta(name: string): Pick<TfbTeam, "birthYear" | "gender" | "programme"> {
  const year = name.match(/(20\d\d)/)?.[1];
  const n = norm(name);
  const programme = /ELITE|ELIT\b/.test(n) ? "Elite" : /\bAJF\b/.test(n) ? "AJF" : /\bLIME\b/.test(n) ? "Lime" : /\bALB\b/.test(n) ? "Alb" : null;
  return { birthYear: year ? Number(year) : null, gender: /FEMININ/.test(n) ? "f" : "m", programme };
}

export function methodOf(label: string): TfbMethod {
  const n = norm(label);
  if (/APLICATIE|ONLINE|APP|RECURENT/.test(n)) return "online";
  if (/CARD|POS/.test(n)) return "card";
  if (/NUMERAR|CASH|CASIERIE|CHITANTA/.test(n)) return "cash";
  return "bank";
}

const isStaffRow = (r: string[]) => !(r[3] ?? "").trim() && !/\d{1,2}\.\d{1,2}\.\d{4}/.test(r[2] ?? "");

/** Interpretează fișierele TFB (deja citite ca tabele) într-un pachet unitar. */
export function parseTfbFiles(files: Array<{ name: string; rows: CsvTable }>, today: string): TfbBundle {
  const warnings: string[] = [];
  const teams: TfbTeam[] = [];
  const staff: TfbStaff[] = [];
  const players = new Map<string, TfbPlayer>();
  const guardians = new Map<string, TfbGuardian>();
  const contacts: TfbContact[] = [];
  const months: TfbMonth[] = [];
  const years = new Set<number>();
  const currentPeriod = `${today.slice(0, 7)}-01`;

  const player = (fullName: string): TfbPlayer => {
    const key = tfbKey(fullName);
    let p = players.get(key);
    if (!p) {
      p = { key, fullName: fullName.trim().replace(/\s+/g, " "), birthDate: null, teams: [], position: null, positionDetail: null, shirt: null, visaUntil: null, registration: null, registeredOn: null, enrolledOn: null, fee: null, matricol: null, active: false };
      players.set(key, p);
    }
    return p;
  };

  const kinds = files.map((f) => ({ ...f, detected: detectTfbFile(f.rows) }));
  for (const f of kinds) if (!f.detected) warnings.push(`Fișier nerecunoscut: ${f.name}.`);
  const byKind = (k: TfbFileKind) => kinds.filter((f) => f.detected?.kind === k);

  for (const f of byKind("teams_staff")) {
    let table = "";
    for (const r of f.rows) {
      if (norm(r[1]) === "NUME ECHIPA" || norm(r[1]) === "NUME") { table = r[0]; continue; }
      if (r[0] === "0" && table === "0" && r[1]?.trim()) {
        teams.push({ name: r[1].trim(), season: r[2]?.trim() || null, type: r[3]?.trim() || null, count: intOrNull(r[4]), coach: r[5]?.trim() || null, ...teamMeta(r[1]) });
      } else if (r[0] === "1" && table === "1" && r[1]?.trim()) {
        staff.push({ name: r[1].trim(), role: r[2]?.trim() || "", license: r[3]?.trim() && r[3].trim() !== "-" ? r[3].trim() : null });
      }
    }
  }

  // Exportul TFB (sursa principală pentru date): prima foaie, cu antet.
  for (const f of byKind("roster")) {
    const head = f.rows[0].map((c) => norm(c));
    const col = (h: string) => head.indexOf(h);
    const [cName, cBirth, cShirt, cVisa, cReg, cRegOn, cEnrol] = [col("NUMELE SI PRENUMELE"), col("DATA NASTERII"), col("NUMAR TRICOU"), col("VALABILITATE VIZA MEDICALA"), col("NUMAR LEGITIMATIE"), col("DATA LEGITIMARE"), col("DATA INREGISTRARE")];
    for (const r of f.rows.slice(1)) {
      const name = (r[cName] ?? "").trim();
      if (!name) continue;
      const p = player(name);
      p.active = true;
      p.birthDate = roDate(r[cBirth]) ?? p.birthDate;
      // TFB lasă uneori alte cifre (un telefon) în câmpul numărului de tricou
      const shirt = cShirt >= 0 ? intOrNull(r[cShirt]) : null;
      p.shirt = shirt !== null && shirt >= 0 && shirt <= 99 ? shirt : p.shirt;
      p.visaUntil = cVisa >= 0 ? roDate(r[cVisa]) ?? p.visaUntil : p.visaUntil;
      const reg = cReg >= 0 ? (r[cReg] ?? "").trim() : "";
      p.registration = reg && reg !== "-" && reg !== "null" ? reg : p.registration;
      p.registeredOn = cRegOn >= 0 ? roDate(r[cRegOn]) ?? p.registeredOn : p.registeredOn;
      p.enrolledOn = cEnrol >= 0 ? roDate(r[cEnrol]) ?? p.enrolledOn : p.enrolledOn;
    }
  }

  for (const f of byKind("player_teams")) {
    for (const r of f.rows.slice(1)) {
      if (!r[0]?.trim() || isStaffRow(r)) continue;
      const p = player(r[0]);
      p.active = true;
      p.birthDate ??= roDate(r[2]);
      const pos = position(r[1] ?? "");
      p.position ??= pos.code;
      p.positionDetail ??= pos.detail;
      for (const t of (r[3] ?? "").split("|").map((x) => x.trim()).filter(Boolean)) if (!p.teams.includes(t)) p.teams.push(t);
    }
  }

  // Grila plăților: un rând pe jucător și an.
  for (const f of byKind("payments").sort((a, b) => (b.detected!.year ?? 0) - (a.detected!.year ?? 0))) {
    for (const r of f.rows.slice(1)) {
      const year = Number(r[0]);
      if (!Number.isFinite(year)) continue;
      years.add(year);
      const block = (r[1] ?? "").split("|").map((x) => x.trim()).filter(Boolean);
      if (!block.length) continue;
      const matricol = block.find((x) => /^\d{2,6}$/.test(x));
      // același nume, alt număr matricol: e un omonim (de exemplu doi „Pop Bogdan"), cu rândurile lui separate
      const base = player(block[0]);
      let p = base;
      if (matricol && base.matricol && base.matricol !== matricol) {
        const key = `${base.key} #${matricol}`;
        p = players.get(key) ?? { ...base, key, fullName: block[0].trim().replace(/\s+/g, " "), birthDate: null, teams: [], position: null, positionDetail: null, shirt: null, visaUntil: null, registration: null, registeredOn: null, enrolledOn: null, fee: null, matricol, active: false };
        players.set(key, p);
      }
      p.matricol ??= matricol ?? null;
      if (!p.teams.length) for (const t of block.slice(1).filter((x) => x !== matricol)) p.teams.push(t);
      const fee = leiToBani(r[2] ?? "");
      if (year === Number(today.slice(0, 4)) || p.fee === null) p.fee = fee ?? p.fee;
      for (let m = 0; m < 12; m++) {
        const text = (r[3 + m * 2] ?? "").trim();
        const color = (r[4 + m * 2] ?? "").trim();
        if (!text || text === "-") continue;
        const am = text.match(/^([\d.,]+)\s*(.*)$/);
        if (!am) { warnings.push(`${p.fullName}, ${m + 1}/${year}: valoare necitită („${text}").`); continue; }
        const amount = leiToBani(am[1]);
        if (amount === null || amount <= 0) continue;
        const label = am[2].trim();
        const period = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        // verde = plătit (uneori fără metodă), roșu = restant, fără culoare = lună viitoare sau fără taxă
        const green = /63, 195, 128/.test(color);
        const red = /242, 38, 19/.test(color);
        const paid = !!label || green;
        if (!paid && !red && period !== currentPeriod) continue;
        if (period > currentPeriod && !paid) continue;
        const methodLabel = paid ? label || "fără metodă" : null;
        months.push({ player: p.key, period, amount, paid, method: methodLabel ? methodOf(methodLabel) : null, methodLabel });
      }
    }
  }

  for (const f of byKind("app_users")) {
    for (const r of f.rows.slice(1)) {
      const [name, rel, kids, phone, email, recurring] = r.map((x) => (x ?? "").trim());
      if (!name) continue;
      const relN = norm(rel.split(",")[0]);
      const children = kids.split(",").map((x) => x.trim()).filter(Boolean);
      const cleanPhone = phone.replace(/[^\d+]/g, "") || null;
      const cleanEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email.toLowerCase() : null;
      if (relN === "JUCATOR") {
        for (const c of children.length ? children : [name]) contacts.push({ player: tfbKey(c), phone: cleanPhone, email: cleanEmail });
        continue;
      }
      if (!children.length) continue; // cont fără copil legat (staff sau abandonat)
      const relation = relN === "MAMA" ? "mother" : relN === "TATA" ? "father" : relN === "TUTORE" ? "guardian" : "parent";
      const gkey = cleanEmail ?? cleanPhone ?? tfbKey(name);
      const g = guardians.get(gkey) ?? { key: gkey, name: titleCaseIfUpper(name), relation, phone: cleanPhone, email: cleanEmail, children: [], recurring: false };
      for (const c of children) { const k = tfbKey(c); if (!g.children.includes(k)) g.children.push(k); }
      g.recurring ||= recurring === "da";
      guardians.set(gkey, g);
    }
  }

  // Avertismente de legătură: nume din plăți / părinți care nu apar în lista de jucători.
  const unknownKids = new Set<string>();
  for (const g of guardians.values()) for (const c of g.children) if (!players.has(c)) unknownKids.add(c);
  if (unknownKids.size) warnings.push(`${unknownKids.size} copii din lista părinților nu apar printre jucători; legătura lor se sare.`);
  const notInRoster = [...players.values()].filter((p) => !p.active);
  if (notInRoster.length) warnings.push(`${notInRoster.length} jucători apar doar în grila plăților (foști jucători); se importă ca inactivi.`);

  return { teams, staff, players: [...players.values()], guardians: [...guardians.values()], contacts, months, years: [...years].sort(), warnings };
}

function titleCaseIfUpper(name: string): string {
  const t = name.trim().replace(/\s+/g, " ");
  return t === t.toUpperCase() ? titleCase(t) : t;
}

// ---------------------------------------------------------------------------------------------
// Planul
// ---------------------------------------------------------------------------------------------

export type TfbSnapshot = {
  today: string;
  groups: Array<{ id: string; name: string; is_active: boolean }>;
  players: Array<{ id: string; full_name: string; display_name: string; birth_date: string | null; group_id: string | null; is_active: boolean }>;
  guardians: Array<{ id: string; full_name: string; phone: string | null; email: string | null }>;
  links: Array<{ guardian_id: string; player_id: string; is_billing: boolean }>;
  /** taxele lunare existente; `amount` = suma taxei */
  monthly: Array<{ player_id: string; period: string; amount?: number }>;
  /** alocările existente pe taxele lunare (plăți neanulate); `tfb` = plata vine dintr-un import TFB anterior */
  allocated?: Array<{ player_id: string; period: string; amount: number; tfb: boolean }>;
  /** sumele încasate deja în Locker Room, pe luna taxei căreia îi sunt alocate */
  paidByPeriod: Array<{ period: string; amount: number }>;
  groupPlans: string[];
  playerPlans: string[];
};

/** Deciziile luate în ecran: echipa TFB pentru fiecare grupă existentă și jucătorul TFB pentru fiecare jucător existent. */
export type TfbDecisions = {
  /** id grupă existentă → numele echipei TFB ("" = rămâne cum e) */
  groups: Record<string, string>;
  /** id jucător existent → cheia jucătorului TFB ("" = nu e în TFB) */
  players: Record<string, string>;
  /** jucătorii existenți care nu sunt în TFB devin inactivi */
  deactivateMissing: boolean;
};

export type TfbProposals = {
  groups: Array<{ id: string; name: string; suggested: string; options: string[] }>;
  players: Array<{ id: string; name: string; group: string | null; suggested: string; clear: boolean; candidates: Array<{ key: string; label: string }> }>;
};

export type TfbPlan = {
  groups: { create: Array<{ id: string; name: string; birth_year: number | null; gender: "m" | "f"; programme: string | null; sort: number }>; rename: Array<{ id: string; name: string; birth_year: number | null; gender: "m" | "f"; programme: string | null }> };
  players: {
    create: Array<TfbPlayerRow & { id: string }>;
    update: Array<TfbPlayerRow & { id: string }>;
    deactivate: string[];
  };
  guardians: { create: Array<{ id: string; full_name: string; phone: string | null; email: string | null }>; link: Array<{ guardian_id: string; player_id: string; relation: string; is_billing: boolean }> };
  contacts: Array<{ player_id: string; phone: string | null; email: string | null }>;
  feePlans: Array<{ group_id: string | null; player_id: string | null; amount: number; valid_from: string }>;
  charges: Array<{ id: string; player_id: string; guardian_id: string | null; period: string; amount: number }>;
  /** plăți TFB pentru luni care au deja taxă în Locker Room (de exemplu luna curentă, emisă automat) */
  paymentsExisting: Array<{ player_id: string; guardian_id: string | null; period: string; amount: number; method: TfbMethod; received_on: string; note: string | null }>;
  payments: Array<{ charge_id: string; player_id: string; guardian_id: string | null; amount: number; method: TfbMethod; received_on: string; note: string | null; period: string }>;
};
export type TfbPlayerRow = {
  group_id: string | null; full_name: string; display_name: string | null; birth_date: string | null; position: string | null; position_detail: string | null;
  shirt_number: number | null; medical_visa_expires_on: string | null; registration_number: string | null; enrolled_on: string | null; is_active: boolean;
};

export type TfbReconciliation = {
  teams: Array<{ name: string; tfb: number | null; primary: number; alsoIn: number; ok: boolean }>;
  playersTfb: number;
  playersAfter: number;
  months: Array<{ period: string; tfb: number; locker: number; ok: boolean }>;
  arrears: number;
};

export type TfbSummary = {
  groupsCreated: number; groupsRenamed: number; playersCreated: number; playersUpdated: number; playersDeactivated: number; playersInactive: number;
  guardiansCreated: number; links: number; contacts: number; charges: number; payments: number; paidTotal: number; dueTotal: number;
  multiTeam: Array<{ name: string; primary: string; others: string[] }>;
  staff: TfbStaff[];
};

type Uuid = () => string;

const groupKey = (s: string) => norm(s);

/** Propunerile pentru ecran: ce echipă TFB corespunde fiecărei grupe și ce jucător TFB fiecărui jucător existent. */
export function proposeTfb(bundle: TfbBundle, snap: TfbSnapshot): TfbProposals {
  const teamNames = bundle.teams.map((t) => t.name);
  const suggestTeam = (g: string): string => {
    const exact = teamNames.find((t) => groupKey(t) === groupKey(g));
    if (exact) return exact;
    const u = norm(g).match(/^U ?(\d{1,2})$/)?.[1];
    if (u) {
      const sameU = teamNames.filter((t) => new RegExp(`^U ?${u}\\b`).test(norm(t)));
      return sameU.find((t) => /ELITE/.test(norm(t))) ?? sameU[0] ?? (Number(u) >= 19 ? teamNames.find((t) => /TINERET/.test(norm(t)) && !/FEMININ|VECHI/.test(norm(t))) ?? "" : "");
    }
    return "";
  };
  const groups = snap.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name, suggested: suggestTeam(g.name), options: teamNames }));
  const teamOfGroup = new Map(groups.map((g) => [g.id, g.suggested]));

  // Jucătorii TFB ca „jucători" pentru proposeMatch; grupa lor = grupa existentă legată de prima lor echipă.
  const groupOfTeam = new Map(groups.filter((g) => g.suggested).map((g) => [g.suggested, g.id]));
  const pool: MatchablePlayer[] = bundle.players.map((p) => ({
    id: p.key, display_name: p.fullName, full_name: p.fullName,
    group_id: p.teams.map((t) => groupOfTeam.get(t)).find(Boolean) ?? null,
  }) as MatchablePlayer);
  const label = new Map(bundle.players.map((p) => [p.key, `${p.fullName}${p.birthDate ? ` · ${p.birthDate.slice(0, 4)}` : ""}${p.teams[0] ? ` · ${p.teams[0]}` : ""}`]));
  const players = snap.players.filter((p) => p.is_active).map((p) => {
    // un nume identic (cu sau fără ordinea cuvintelor) este potrivirea sigură
    const same = bundle.players.filter((b) => b.key === tfbKey(p.full_name) && (!p.birth_date || !b.birthDate || b.birthDate === p.birth_date));
    if (same.length === 1) return { id: p.id, name: p.display_name, group: snap.groups.find((g) => g.id === p.group_id)?.name ?? null, suggested: same[0].key, clear: true, candidates: [{ key: same[0].key, label: label.get(same[0].key)! }] };
    const prop = proposeMatch(p.full_name.length > p.display_name.length ? p.full_name : p.display_name, p.group_id, pool);
    const team = p.group_id ? teamOfGroup.get(p.group_id) : undefined;
    const inTeam = (key: string | null | undefined) => !!team && bundle.players.find((b) => b.key === key)?.teams.includes(team) === true;
    // sigur: potrivirea e în echipa legată de grupa jucătorului și e singurul candidat de acolo
    const onlyInTeam = !!prop.suggested && inTeam(prop.suggested) && prop.candidates.filter((c) => inTeam(c.player_id)).length === 1;
    return {
      id: p.id, name: p.display_name, group: snap.groups.find((g) => g.id === p.group_id)?.name ?? null,
      suggested: prop.suggested ?? "", clear: onlyInTeam || (prop.confident && (!team || inTeam(prop.suggested))),
      candidates: prop.candidates.map((c) => ({ key: c.player_id, label: label.get(c.player_id) ?? c.player_id })),
    };
  });
  return { groups, players };
}

/** Planul complet: ce se creează, ce se actualizează și cum se împacă cifrele cu TFB. */
export function planTfbImport(bundle: TfbBundle, snap: TfbSnapshot, decisions: TfbDecisions, uuid: Uuid): { plan: TfbPlan; summary: TfbSummary; reconciliation: TfbReconciliation } {
  const plan: TfbPlan = {
    groups: { create: [], rename: [] },
    players: { create: [], update: [], deactivate: [] },
    guardians: { create: [], link: [] },
    contacts: [], feePlans: [], charges: [], payments: [], paymentsExisting: [],
  };
  const currentPeriod = `${snap.today.slice(0, 7)}-01`;

  // --- echipe
  const groupForTeam = new Map<string, string>();
  for (const [gid, team] of Object.entries(decisions.groups)) if (team) groupForTeam.set(team, gid);
  let sort = snap.groups.length;
  for (const t of bundle.teams) {
    const meta = { birth_year: t.birthYear, gender: t.gender, programme: t.programme };
    const existing = groupForTeam.get(t.name) ?? snap.groups.find((g) => groupKey(g.name) === groupKey(t.name))?.id;
    if (existing) {
      groupForTeam.set(t.name, existing);
      const g = snap.groups.find((x) => x.id === existing);
      if (g && (g.name !== t.name || !g.is_active)) plan.groups.rename.push({ id: existing, name: t.name, ...meta });
    } else {
      const id = uuid();
      groupForTeam.set(t.name, id);
      plan.groups.create.push({ id, name: t.name, ...meta, sort: ++sort });
    }
  }

  // --- jucători
  const existingFor = new Map<string, string>(); // cheie TFB → id existent
  for (const [pid, key] of Object.entries(decisions.players)) if (key) existingFor.set(key, pid);
  // jucătorii fără decizie în ecran (de obicei inactivi: foști jucători aduși la o rulare anterioară)
  // se regăsesc după nume, ca o nouă rulare să nu-i dubleze
  const mapped = new Set(existingFor.values());
  for (const p of snap.players) {
    if (p.id in decisions.players || mapped.has(p.id)) continue;
    const base = tfbKey(p.full_name);
    // numele simplu sau un omonim („NUME #matricol") încă nelegat
    const key = bundle.players.find((b) => (b.key === base || b.key.startsWith(`${base} #`)) && !existingFor.has(b.key))?.key;
    if (key) { existingFor.set(key, p.id); mapped.add(p.id); }
  }
  const rosterKeys = new Set(bundle.players.filter((p) => p.active).map((p) => p.key));
  const usedDisplay = new Set(snap.players.map((p) => norm(p.display_name)));
  const playerId = new Map<string, string>();
  const multiTeam: TfbSummary["multiTeam"] = [];
  const primaryTeam = (p: TfbPlayer): string | null => {
    if (!p.teams.length) return null;
    const year = p.birthDate ? Number(p.birthDate.slice(0, 4)) : null;
    const byYear = year ? p.teams.filter((t) => bundle.teams.find((x) => x.name === t)?.birthYear === year) : [];
    return byYear.find((t) => /ELITE/.test(norm(t))) ?? byYear[0] ?? p.teams[0];
  };
  const primaryOf = new Map<string, string | null>();
  for (const p of bundle.players) {
    const primary = primaryTeam(p);
    primaryOf.set(p.key, primary);
    if (p.teams.length > 1 && primary) multiTeam.push({ name: p.fullName, primary, others: p.teams.filter((t) => t !== primary) });
    const active = rosterKeys.has(p.key) && p.teams.length > 0;
    const row: TfbPlayerRow = {
      group_id: primary ? groupForTeam.get(primary) ?? null : null,
      full_name: p.fullName, display_name: null, birth_date: p.birthDate, position: p.position, position_detail: p.positionDetail,
      shirt_number: p.shirt, medical_visa_expires_on: p.visaUntil, registration_number: p.registration, enrolled_on: p.enrolledOn ?? p.registeredOn, is_active: active,
    };
    const existing = existingFor.get(p.key);
    if (existing) {
      playerId.set(p.key, existing);
      plan.players.update.push({ ...row, id: existing });
    } else {
      const id = uuid();
      playerId.set(p.key, id);
      let dn = displayName(p.fullName, false);
      if (usedDisplay.has(norm(dn))) dn = displayName(p.fullName, true);
      usedDisplay.add(norm(dn));
      plan.players.create.push({ ...row, id, display_name: dn });
    }
  }
  if (decisions.deactivateMissing) {
    const kept = new Set(existingFor.values());
    for (const p of snap.players) if (p.is_active && !kept.has(p.id)) plan.players.deactivate.push(p.id);
  }

  // --- părinți
  const linked = new Set(snap.links.map((l) => `${l.guardian_id}|${l.player_id}`));
  const billingTaken = new Set(snap.links.filter((l) => l.is_billing).map((l) => l.player_id));
  const guardianOfPlayer = new Map<string, string>();
  for (const l of snap.links.filter((x) => x.is_billing)) guardianOfPlayer.set(l.player_id, l.guardian_id);
  // întâi cei cu plată recurentă activă (plătesc deja), apoi mamele, apoi restul
  const ordered = [...bundle.guardians].sort((a, b) => Number(b.recurring) - Number(a.recurring) || Number(b.relation === "mother") - Number(a.relation === "mother"));
  for (const g of ordered) {
    const kids = g.children.map((k) => playerId.get(k)).filter((x): x is string => !!x);
    if (!kids.length) continue;
    const existing = snap.guardians.find((x) => (g.email && x.email?.toLowerCase() === g.email) || (g.phone && x.phone?.replace(/[^\d+]/g, "") === g.phone)
      // fără telefon și e-mail, singurul semn e numele (altfel o nouă rulare l-ar dubla)
      || (!g.email && !g.phone && !x.email && !x.phone && tfbKey(x.full_name) === tfbKey(g.name)));
    let gid = existing?.id;
    if (!gid) {
      gid = uuid();
      plan.guardians.create.push({ id: gid, full_name: g.name, phone: g.phone, email: g.email });
    }
    for (const pid of kids) {
      if (linked.has(`${gid}|${pid}`)) continue;
      linked.add(`${gid}|${pid}`);
      const billing = !billingTaken.has(pid);
      if (billing) { billingTaken.add(pid); guardianOfPlayer.set(pid, gid); }
      plan.guardians.link.push({ guardian_id: gid, player_id: pid, relation: g.relation, is_billing: billing });
    }
  }
  // un singur rând de contact pe jucător: primul telefon și primul e-mail găsite
  const contactOf = new Map<string, TfbPlan["contacts"][number]>();
  for (const c of bundle.contacts) {
    const pid = playerId.get(c.player);
    if (!pid || !(c.phone || c.email)) continue;
    const had = contactOf.get(pid);
    if (had) { had.phone ??= c.phone; had.email ??= c.email; } else contactOf.set(pid, { player_id: pid, phone: c.phone, email: c.email });
  }
  plan.contacts.push(...contactOf.values());

  // --- taxe: planul echipei = taxa cea mai frecventă; excepțiile pe jucător
  const feesByGroup = new Map<string, number[]>();
  for (const p of bundle.players) {
    const gid = plan.players.create.find((x) => x.id === playerId.get(p.key))?.group_id ?? plan.players.update.find((x) => x.id === playerId.get(p.key))?.group_id;
    if (!gid || p.fee === null || !rosterKeys.has(p.key)) continue;
    feesByGroup.set(gid, [...(feesByGroup.get(gid) ?? []), p.fee]);
  }
  const groupFee = new Map<string, number>();
  for (const [gid, fees] of feesByGroup) {
    const counts = new Map<number, number>();
    for (const f of fees) counts.set(f, (counts.get(f) ?? 0) + 1);
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    groupFee.set(gid, mode);
    if (!snap.groupPlans.includes(gid)) plan.feePlans.push({ group_id: gid, player_id: null, amount: mode, valid_from: currentPeriod });
  }
  for (const p of bundle.players) {
    const pid = playerId.get(p.key)!;
    const gid = [...plan.players.create, ...plan.players.update].find((x) => x.id === pid)?.group_id;
    if (!gid || p.fee === null || !rosterKeys.has(p.key) || snap.playerPlans.includes(pid)) continue;
    if (groupFee.get(gid) !== p.fee) plan.feePlans.push({ group_id: null, player_id: pid, amount: p.fee, valid_from: currentPeriod });
  }

  // --- istoricul: o taxă pe lună (dacă nu există deja) și plata ei, când TFB o arată plătită
  const existingMonthly = new Set(snap.monthly.map((m) => `${m.player_id}|${m.period}`));
  const chargeAmount = new Map(snap.monthly.map((m) => [`${m.player_id}|${m.period}`, m.amount ?? 0]));
  const allocatedTo = new Map<string, number>();
  const tfbPaidBefore = new Set<string>();
  for (const a of snap.allocated ?? []) {
    const k = `${a.player_id}|${a.period}`;
    allocatedTo.set(k, (allocatedTo.get(k) ?? 0) + a.amount);
    if (a.tfb) tfbPaidBefore.add(k);
  }
  for (const m of bundle.months) {
    const pid = playerId.get(m.player);
    if (!pid || (m.period > currentPeriod && !m.paid)) continue;
    const key = `${pid}|${m.period}`;
    if (existingMonthly.has(key)) {
      // taxa există deja (emisă din Locker Room): plata din TFB se alocă ei, o singură dată și doar cât mai e de plată
      const open = (chargeAmount.get(key) ?? 0) - (allocatedTo.get(key) ?? 0);
      if (m.paid && m.method && !tfbPaidBefore.has(key) && open >= m.amount && !plan.charges.some((c) => c.player_id === pid && c.period === m.period)) {
        tfbPaidBefore.add(key);
        plan.paymentsExisting.push({ player_id: pid, guardian_id: guardianOfPlayer.get(pid) ?? null, period: m.period, amount: m.amount, method: m.method, received_on: m.period > snap.today ? snap.today : m.period, note: `Import TFB · ${m.methodLabel}` });
      }
      continue;
    }
    existingMonthly.add(`${pid}|${m.period}`);
    const cid = uuid();
    const gid = guardianOfPlayer.get(pid) ?? null;
    plan.charges.push({ id: cid, player_id: pid, guardian_id: gid, period: m.period, amount: m.amount });
    // data reală a plății nu apare în TFB: se ia luna taxei (sau azi, pentru o lună plătită în avans)
    const received = m.period > snap.today ? snap.today : m.period;
    if (m.paid && m.method) plan.payments.push({ charge_id: cid, player_id: pid, guardian_id: gid, amount: m.amount, method: m.method, received_on: received, note: `Import TFB · ${m.methodLabel}`, period: m.period });
  }

  // --- împăcarea cu TFB
  const all = [...plan.players.create, ...plan.players.update];
  const active = all.filter((p) => p.is_active);
  const teams = bundle.teams.map((t) => {
    const gid = groupForTeam.get(t.name);
    const primary = active.filter((p) => p.group_id === gid).length;
    const alsoIn = bundle.players.filter((p) => rosterKeys.has(p.key) && p.teams.includes(t.name) && primaryOf.get(p.key) !== t.name).length;
    return { name: t.name, tfb: t.count, primary, alsoIn, ok: t.count === null || t.count === primary + alsoIn };
  });
  const tfbPaid = new Map<string, number>();
  for (const m of bundle.months) if (m.paid && playerId.has(m.player)) tfbPaid.set(m.period, (tfbPaid.get(m.period) ?? 0) + m.amount);
  const lockerPaid = new Map<string, number>();
  for (const p of snap.paidByPeriod) lockerPaid.set(p.period, (lockerPaid.get(p.period) ?? 0) + p.amount);
  for (const p of [...plan.payments, ...plan.paymentsExisting]) lockerPaid.set(p.period, (lockerPaid.get(p.period) ?? 0) + p.amount);
  const periods = [...new Set([...tfbPaid.keys(), ...lockerPaid.keys()])].sort();
  const months = periods.map((period) => ({ period, tfb: tfbPaid.get(period) ?? 0, locker: lockerPaid.get(period) ?? 0, ok: (tfbPaid.get(period) ?? 0) === (lockerPaid.get(period) ?? 0) }));
  const dueTotal = bundle.months.filter((m) => !m.paid && m.period <= currentPeriod).reduce((s, m) => s + m.amount, 0);

  const summary: TfbSummary = {
    groupsCreated: plan.groups.create.length, groupsRenamed: plan.groups.rename.length,
    playersCreated: plan.players.create.length, playersUpdated: plan.players.update.length, playersDeactivated: plan.players.deactivate.length,
    playersInactive: all.filter((p) => !p.is_active).length,
    guardiansCreated: plan.guardians.create.length, links: plan.guardians.link.length, contacts: plan.contacts.length,
    charges: plan.charges.length, payments: plan.payments.length,
    paidTotal: plan.payments.reduce((s, p) => s + p.amount, 0), dueTotal,
    multiTeam, staff: bundle.staff,
  };
  const reconciliation: TfbReconciliation = {
    teams, playersTfb: rosterKeys.size, playersAfter: active.length + snap.players.filter((p) => p.is_active && !all.some((x) => x.id === p.id) && !plan.players.deactivate.includes(p.id)).length,
    months, arrears: dueTotal,
  };
  return { plan, summary, reconciliation };
}

/** „Popescu Andrei Mihai" → „POPESCU A." (stilul numelor scurte din club); la coliziune, „POPESCU Andrei". */
function displayName(full: string, long: boolean): string {
  const t = full.trim().split(/\s+/);
  if (t.length < 2) return full.toUpperCase();
  return long ? `${t[0].toUpperCase()} ${t.slice(1).join(" ")}` : `${t[0].toUpperCase()} ${t[1][0].toUpperCase()}.`;
}

// ---------------------------------------------------------------------------------------------
// Transportul către server: grila plăților ocupă cel mai mult, deci lunile se trimit ca tupluri.
// ---------------------------------------------------------------------------------------------

export type TfbPacked = Omit<TfbBundle, "months"> & {
  /** [indexul jucătorului, „AAAA-LL", suma în bani, indexul etichetei metodei sau -1 dacă nu e plătită] */
  months: Array<[number, string, number, number]>;
  labels: string[];
};

export function packTfbBundle(b: TfbBundle): TfbPacked {
  const idx = new Map(b.players.map((p, i) => [p.key, i]));
  const labels: string[] = [];
  const months: TfbPacked["months"] = [];
  for (const m of b.months) {
    const i = idx.get(m.player);
    if (i === undefined) continue;
    let l = -1;
    if (m.paid && m.methodLabel) {
      l = labels.indexOf(m.methodLabel);
      if (l < 0) { labels.push(m.methodLabel); l = labels.length - 1; }
    }
    months.push([i, m.period.slice(0, 7), m.amount, l]);
  }
  return { ...b, months, labels };
}

export function unpackTfbBundle(p: TfbPacked): TfbBundle {
  const months: TfbMonth[] = [];
  for (const [i, ym, amount, l] of p.months) {
    const player = p.players[i];
    if (!player || !/^\d{4}-\d{2}$/.test(ym) || !Number.isInteger(amount) || amount <= 0) continue;
    const label = l >= 0 ? p.labels[l] ?? null : null;
    months.push({ player: player.key, period: `${ym}-01`, amount, paid: l >= 0, method: label ? methodOf(label) : null, methodLabel: label });
  }
  return { ...p, months };
}
