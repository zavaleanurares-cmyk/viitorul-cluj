import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parseHealthSheet, parseFatigueGrid, buildWellnessEntries, parseStatusText, parseZoneText, parseScore,
  proposeMatch, suggestGroupForBlock, suggestMapping, readTable, applyMapping, PHYSICAL_FIELDS,
  parseNumber, parseDate, parseDuration, norm, type MatchablePlayer,
} from "../src";

function csv(text: string): string[][] {
  return text.split(/\r?\n/).map((l) => l.split(","));
}
const dir = path.resolve(__dirname, "../../../data/private");
const hasPrivate = fs.existsSync(path.join(dir, "stare-de-sanatate.csv"));

describe("stare și zonă din text liber", () => {
  it("recunoaște vocabularul clubului", () => {
    expect(parseStatusText("APT").code).toBe("APT");
    expect(parseStatusText("acc").code).toBe("ACC");
    expect(parseStatusText("ACC")).toMatchObject({ code: "ACC", note: null, flagged: false });
    expect(parseStatusText("readaptare la efort")).toMatchObject({ code: "READAPTARE", note: null });
    expect(parseStatusText("OBOSEALA")).toMatchObject({ code: "OBOSEALA", note: null });
    expect(parseStatusText("Se observa o stare de oboseala")).toMatchObject({
      code: "OBOSEALA", note: "Se observa o stare de oboseala", flagged: false,
    });
    expect(parseStatusText("Usor racit")).toMatchObject({ code: "ALT_MOTIV", note: "Usor racit", flagged: false });
    expect(parseStatusText("REVINE DE LUNI IN ANTRENAMENT")).toMatchObject({ code: "ALT_MOTIV", flagged: true });
    expect(parseStatusText("ceva necunoscut")).toMatchObject({ code: "ALT_MOTIV", flagged: true });
  });

  it("interpretează zonele, inclusiv cele neregulate", () => {
    expect(parseZoneText("-").zone).toBeNull();
    expect(parseZoneText("UMAR")).toMatchObject({ zone: "shoulder", detail: null, flagged: false });
    expect(parseZoneText("acc. umar")).toMatchObject({ zone: "shoulder", detail: null });
    expect(parseZoneText("acc.hamstring")).toMatchObject({ zone: "thigh_back", detail: null });
    expect(parseZoneText("Knee")).toMatchObject({ zone: "knee" });
    expect(parseZoneText("accidentare metatarsiene")).toMatchObject({ zone: "foot", detail: "metatarsiene" });
    expect(parseZoneText("Ligament")).toMatchObject({ zone: null, detail: "Ligament", flagged: true });
    expect(parseZoneText("Genunchi/Coapsa?")).toMatchObject({ zone: "knee", uncertain: true, flagged: true, detail: "Genunchi/Coapsa?" });
    expect(parseZoneText("5/10")).toMatchObject({ zone: null, misplacedValue: "5/10", flagged: true });
    expect(parseZoneText("genunchi stang")).toMatchObject({ zone: "knee", side: "left" });
  });

  it("citește scorurile 1–10", () => {
    expect(parseScore("6")).toEqual({ value: 6, flagged: false, reason: null });
    expect(parseScore("")).toMatchObject({ value: null, flagged: false });
    expect(parseScore("3/4")).toMatchObject({ value: 4, flagged: true });
    expect(parseScore("11")).toMatchObject({ value: null, flagged: true });
    expect(parseScore("abc")).toMatchObject({ value: null, flagged: true });
  });
});

describe("potrivirea numelor", () => {
  const players: MatchablePlayer[] = [
    { id: "1", display_name: "KIS PATRICK", full_name: "KIS PATRICK", group_id: "L3" },
    { id: "2", display_name: "DAVID POPTEAN", full_name: "DAVID POPTEAN", group_id: "L3" },
    { id: "3", display_name: "MIRCEA DAVID", full_name: "MIRCEA DAVID", group_id: "L3" },
    { id: "4", display_name: "POP PATRIK", full_name: "POP PATRIK", group_id: "U17" },
    { id: "5", display_name: "DAMIAN", full_name: "DAMIAN", group_id: "U15" },
    { id: "6", display_name: "CORJENCO", full_name: "CORJENCO", group_id: "L3" },
    { id: "7", display_name: "CORJENCO", full_name: "CORJENCO", group_id: "U16" },
    { id: "8", display_name: "OCTA KIS", full_name: "OCTA KIS", group_id: "U21" },
    { id: "9", display_name: "KIS", full_name: "KIS", group_id: "U15" },
  ];
  it("propune, nu decide", () => {
    const p = proposeMatch("PATRICK", "L3", players);
    expect(p.candidates[0].player_id).toBe("1");
    expect(p.confident).toBe(false); // nume parțial: cere confirmare
    expect(proposeMatch("DAVID P.", "L3", players).candidates[0].player_id).toBe("2");
    expect(proposeMatch("MIRCEA D.", "L3", players).candidates[0].player_id).toBe("3");
  });
  it("ține cont de grupă la nume identice", () => {
    const p = proposeMatch("CORJENCO", "U16", players);
    expect(p.candidates[0].player_id).toBe("7");
    expect(p.confident).toBe(true);
    const q = proposeMatch("DAMIAN", "L3", players);
    expect(q.candidates[0].player_id).toBe("5");
    expect(q.confident).toBe(false); // același nume, altă grupă
  });
  it("folosește potrivirile memorate", () => {
    const p = proposeMatch("PATRICK", "L3", players, [{ source_name: norm("PATRICK"), group_id: "L3", player_id: "1" }]);
    expect(p.candidates[0]).toMatchObject({ player_id: "1", reason: "memorat", score: 1 });
    expect(p.confident).toBe(true);
  });
  it("o inițială singură nu este o potrivire", () => {
    const l3 = [{ id: "b", display_name: "BLIDAREAN D.", full_name: "BLIDAREAN D.", group_id: "L3" }];
    expect(proposeMatch("DAMIAN", "L3", l3).candidates).toEqual([]);
    expect(proposeMatch("BLIDAREAN", "L3", l3).candidates[0].player_id).toBe("b");
  });
  it("nu inventează potriviri", () => {
    expect(proposeMatch("TELINA", "L3", players).suggested).toBeNull();
  });
});

describe("import generic prin mapare", () => {
  const sheet = [
    ["Export GPS"],
    ["Player", "Date", "Session", "Duration", "Total Distance (m)", "Dist > 20 km/h (m)", "N° Sprints", "Max Speed (km/h)", "Acc", "Dec", "Metabolic Power"],
    ["Pop Darius", "06.10.2026", "Antrenament MD-3", "01:25:30", "8.432,5", "612", "14", "31,2", "42", "39", "9.8"],
    ["Average", "", "", "", "8000", "", "", "", "", "", ""],
  ];
  it("ghicește coloanele și convertește valorile", () => {
    const table = readTable(sheet);
    expect(table.headerRow).toBe(2);
    const mapping = suggestMapping(table.headers, PHYSICAL_FIELDS);
    expect(Object.values(mapping)).toEqual(expect.arrayContaining([
      "player", "session_date", "session_name", "duration_min", "total_distance_m", "hsr_distance_m",
      "sprint_count", "max_speed_kmh", "accelerations", "decelerations",
    ]));
    const [rec] = applyMapping(table, mapping, PHYSICAL_FIELDS);
    expect(rec.values).toMatchObject({
      player: "Pop Darius", session_date: "2026-10-06", duration_min: 85.5, total_distance_m: 8432.5,
      hsr_distance_m: 612, sprint_count: 14, max_speed_kmh: 31.2, accelerations: 42, decelerations: 39,
    });
    expect(rec.errors).toEqual([]);
  });
  it("citește numere, date și durate în formatele uzuale", () => {
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("31,2")).toBe(31.2);
    expect(parseNumber("12 345")).toBe(12345);
    expect(parseDate("7/10/26")).toBe("2026-10-07");
    expect(parseDate("2026-10-07")).toBe("2026-10-07");
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDuration("92")).toBe(92);
    expect(parseDuration("1:30:00")).toBe(90);
  });
});

describe.skipIf(!hasPrivate)("tabelele reale ale clubului", () => {
  const groups = ["Liga 3", "U21", "U17", "U16", "U15"].map((name, i) => ({ id: name, name, sort: i + 1 }));

  it("STARE DE SANATATE: 115 jucători în 5 grupe", () => {
    const parsed = parseHealthSheet(csv(fs.readFileSync(path.join(dir, "stare-de-sanatate.csv"), "utf8")));
    expect(parsed.columns).toEqual({ name: 0, status: 1, zone: 3 });
    expect(parsed.blocks.map((b) => b.label)).toEqual(["", "U21", "U17", "U16", "U15"]);
    expect(parsed.blocks.map((b) => b.rows.length)).toEqual([25, 21, 22, 21, 26]);
    expect(parsed.totalRows).toBe(115);
    expect(parsed.blocks.map((b, i) => suggestGroupForBlock(b.label, groups, i)?.name)).toEqual(["Liga 3", "U21", "U17", "U16", "U15"]);

    const all = parsed.blocks.flatMap((b) => b.rows);
    const by = (name: string, block: number) => parsed.blocks[block].rows.find((r) => r.name === name)!;
    const counts: Record<string, number> = {};
    for (const r of all) counts[r.status.code] = (counts[r.status.code] ?? 0) + 1;
    expect(counts).toEqual({ APT: 99, OBOSEALA: 4, READAPTARE: 5, ACC: 5, ALT_MOTIV: 2 } satisfies Record<string, number>);

    expect(by("BELLO", 0)).toMatchObject({ status: { code: "READAPTARE" }, zone: { zone: "shoulder" }, flagged: false });
    expect(by("TARTA", 0)).toMatchObject({ status: { code: "ALT_MOTIV" }, note: "Usor racit", flagged: false });
    expect(by("MARINCAS", 0)).toMatchObject({ status: { code: "ALT_MOTIV" }, note: "REVINE DE LUNI IN ANTRENAMENT", flagged: true });
    expect(by("FRICIU CODRUT", 1)).toMatchObject({ status: { code: "OBOSEALA" }, zone: { zone: null }, flagged: true });
    expect(by("FRICIU CODRUT", 1).note).toContain("5/10");
    expect(by("GLIGOR DENIS", 1)).toMatchObject({ status: { code: "ACC" }, zone: { zone: null, detail: "Ligament" }, flagged: true });
    expect(by("BRANDUSAN", 2)).toMatchObject({ zone: { zone: "knee", uncertain: true }, flagged: true });
    expect(by("CZIRI", 3)).toMatchObject({ status: { code: "ACC" }, zone: { zone: "shoulder" }, flagged: false });
    expect(by("IELCEAN DARIUS", 3)).toMatchObject({ status: { code: "READAPTARE" }, zone: { zone: "foot", detail: "metatarsiene" } });
    expect(by("HORATIU", 3)).toMatchObject({ status: { code: "READAPTARE" }, flagged: true });
    // nume identice în grupe diferite rămân jucători diferiți
    expect(all.filter((r) => r.name === "CHIS").length).toBe(2);
    expect(all.filter((r) => r.name === "CORJENCO").length).toBe(2);
  });

  it("FATIGUE L3: grilă săptămânală -> chestionare zilnice", () => {
    const grid = parseFatigueGrid(csv(fs.readFileSync(path.join(dir, "fatigue-l3.csv"), "utf8")));
    expect(grid.rows.length).toBe(26);
    const col = (i: number) => grid.columns.find((c) => c.index === i)!;
    expect(col(4)).toMatchObject({ metric: "fatigue", day: 1, inferred: false });
    expect(col(5)).toMatchObject({ metric: "fatigue", day: 2 });
    expect(col(10)).toMatchObject({ metric: "muscle_load", day: 1, inferred: true });
    expect(col(11)).toMatchObject({ metric: "muscle_load", day: 2, inferred: true });
    expect(col(13)).toMatchObject({ metric: "pain", day: 1, inferred: true });
    expect(col(14)).toMatchObject({ metric: "pain", day: 2, inferred: true });

    const { entries, namesWithoutData } = buildWellnessEntries(grid, grid.columns, "2026-09-28");
    expect(namesWithoutData.map((n) => n.name)).toEqual(["CORJENCO", "PIRV", "PUNGEA", "MIRCEA D.", "TARTA", "DAMIAN"]);
    expect(entries.length).toBe(21);
    const of = (name: string) => entries.filter((e) => e.name === name);
    expect(of("PATRICK")[0]).toMatchObject({ entry_date: "2026-09-29", fatigue: 6, muscle_load: 6, flagged: false });
    expect(of("CHIRIL")[0]).toMatchObject({ fatigue: 5, muscle_load: 4, pain_zone: "thigh_back", flagged: true });
    expect(of("CHIRIL")[0].raw).toMatchObject({ muscle_load: "3/4" });
    expect(of("HAFIZ")[0]).toMatchObject({ fatigue: 3, muscle_load: null, pain_zone: "knee" });
    expect(of("HERCIU")).toHaveLength(2);
    expect(of("HERCIU")[1]).toMatchObject({ entry_date: "2026-09-30", fatigue: 5, muscle_load: 9, pain_zone: "thigh_back" });
  });
});
