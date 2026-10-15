import "server-only";
import { strToU8, zipSync } from "fflate";
import { schemaMeta, withIdentity, type ForeignKey } from "@club/db";
import { plural } from "@club/shared";

/**
 * Exportul complet al datelor unui club: un CSV pe tabel, într-o arhivă ZIP.
 * Rulează cu identitatea celui care exportă (RLS și drepturile pe coloane rămân în vigoare),
 * iar fiecare tabel se limitează la clubul curent: direct prin `club_id` sau prin cheile străine
 * până la primul tabel care are `club_id` (de exemplu: prezența → evenimentul → clubul).
 */

/** Tabele tehnice sau trecătoare, fără valoare în afara aplicației. */
const SKIP = new Set(["_migrations", "push_tokens", "provider_events", "club_counters", "notifications", "name_matches"]);
/** Legăturile prin conturi sunt ultima variantă: un cont poate aparține mai multor cluburi. */
const WEAK_PARENTS = new Set(["profiles"]);

type Plan = { table: string; columns: string[]; joins: ForeignKey[] };

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  // o celulă care începe cu = + - @ ar fi executată ca formulă în Excel
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string" && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type ClubExport = { zip: Uint8Array; tables: Array<{ table: string; rows: number }>; skipped: string[] };

export async function buildClubExport(opts: { userId: string; clubId: string; clubName: string; who: string; today: string }): Promise<ClubExport> {
  const meta = await schemaMeta();
  const hasClub = (t: string) => meta.tables.get(t)?.columns.has("club_id") ?? false;

  /** Cel mai scurt drum (cel mult 3 legături) de la un tabel la un tabel cu `club_id`. */
  const pathToClub = (table: string): ForeignKey[] | null => {
    const queue: Array<{ at: string; via: ForeignKey[] }> = [{ at: table, via: [] }];
    const seen = new Set([table]);
    let weak: ForeignKey[] | null = null;
    while (queue.length) {
      const { at, via } = queue.shift()!;
      if (via.length >= 3) continue;
      for (const fk of meta.foreignKeys.filter((f) => f.table === at && f.refTable !== at)) {
        if (seen.has(fk.refTable) || !meta.tables.has(fk.refTable)) continue;
        const next = [...via, fk];
        if (hasClub(fk.refTable)) {
          if (!WEAK_PARENTS.has(fk.refTable)) return next;
          weak ??= next;
          continue;
        }
        seen.add(fk.refTable);
        queue.push({ at: fk.refTable, via: next });
      }
    }
    return weak;
  };

  return withIdentity({ sub: opts.userId, role: "authenticated" }, async (client, role) => {
    const { rows: real } = await client.query<{ name: string }>(
      "select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1",
    );
    const plans: Plan[] = [];
    const skipped: string[] = [];
    for (const { name } of real) {
      const t = meta.tables.get(name);
      if (!t || SKIP.has(name)) continue;
      const columns = [...t.columns.values()].filter((c) => !c.deniedFor.includes(role)).map((c) => c.name);
      if (!columns.length) continue;
      if (name === "clubs" || hasClub(name)) { plans.push({ table: name, columns, joins: [] }); continue; }
      const joins = pathToClub(name);
      if (joins) plans.push({ table: name, columns, joins });
      else skipped.push(name);
    }

    const files: Record<string, Uint8Array> = {};
    const tables: ClubExport["tables"] = [];
    for (const p of plans) {
      let from = `public.${q(p.table)} t0`;
      p.joins.forEach((fk, i) => {
        const on = fk.columns.map((c, k) => `t${i + 1}.${q(fk.refColumns[k])} = t${i}.${q(c)}`).join(" and ");
        from += ` join public.${q(fk.refTable)} t${i + 1} on ${on}`;
      });
      const where = p.table === "clubs" ? "t0.id = $1" : `t${p.joins.length}.club_id = $1`;
      const order = meta.tables.get(p.table)?.primaryKey.map((c) => `t0.${q(c)}`).join(", ") || "1";
      // fiecare tabel într-un punct de salvare: un tabel pe care rolul nu îl poate citi nu oprește exportul
      await client.query("savepoint tbl");
      try {
        const { rows } = await client.query({ text: `select ${p.columns.map((c) => `t0.${q(c)}`).join(", ")} from ${from} where ${where} order by ${order}`, values: [opts.clubId], rowMode: "array" });
        await client.query("release savepoint tbl");
        if (!rows.length) continue;
        const lines = [p.columns.join(";"), ...rows.map((r: unknown[]) => r.map(csvCell).join(";"))];
        files[`date/${p.table}.csv`] = strToU8("﻿" + lines.join("\r\n"));
        tables.push({ table: p.table, rows: rows.length });
      } catch {
        await client.query("rollback to savepoint tbl");
        skipped.push(p.table);
      }
    }

    const total = tables.reduce((s, x) => s + x.rows, 0);
    files["CITESTE.txt"] = strToU8([
      `Exportul datelor clubului ${opts.clubName}`,
      `Data: ${opts.today} · exportat de: ${opts.who}`,
      "",
      `Arhiva conține ${plural(tables.length, "tabel", "tabele")} (${plural(total, "rând", "rânduri")}), câte un fișier CSV în folderul „date".`,
      "Fișierele CSV folosesc separatorul „;\" și codificarea UTF-8 (cu BOM), deci se deschid direct în Excel.",
      "Coloanele cu identificatori (id, *_id) leagă tabelele între ele; valorile JSON sunt scrise ca text.",
      "Sumele de bani sunt în bani (1 leu = 100 de bani).",
      "",
      "Ce nu se află în arhivă:",
      "- documentele încărcate (avize, contracte semnate, fotografii, clipuri): se descarcă din aplicație, de la fiecare jucător sau din fiecare modul;",
      "- câmpurile pe care rolul celui care exportă nu le poate vedea (de exemplu, notele medicale pentru rolurile fără acces medical);",
      "- datele tehnice ale aplicației (sesiuni, notificări, migrări).",
      ...(skipped.length ? ["", `Tabele neincluse: ${skipped.join(", ")}.`] : []),
      "",
      "Tabele:",
      ...tables.map((x) => `- ${x.table}: ${x.rows}`),
      "",
    ].join("\r\n"));

    return { zip: zipSync(files, { level: 6 }), tables, skipped };
  });
}
