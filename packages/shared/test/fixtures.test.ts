import { describe, expect, it } from "vitest";
import { buildFixtures, buildStandings, guessFixtureMapping, guessStandingMapping, parseFixtureDate, parsePastedTable, parseMatchScore } from "../src/fixtures";

const pasted = [
  "Etapa\tData\tOra\tGazde\tOaspeți\tTeren\tScor",
  "Etapa 9\t17.10.2026\t10:00\tOlimpia Sud\tViitorul Cluj\tStadion Sud\t",
  "\t17.10.2026\t12:00\tCS Nord\tUnirea Est\t\t",
  "\t18.10\t\tViitorul Cluj\tAvântul\tBaza Viitorul\t2-1",
  "Etapa 10\tmâine\t\tViitorul Cluj\tCS Nord\t\t",
].join("\n");

describe("import program", () => {
  const table = parsePastedTable(pasted);
  const mapping = guessFixtureMapping(table[0]);
  it("recunoaște coloanele după antet, fără diacritice", () => {
    expect(mapping).toEqual({ round: 0, date: 1, time: 2, home: 3, away: 4, venue: 5, score: 6 });
  });
  it("păstrează doar meciurile noastre, cu etapa propagată și ora implicită", () => {
    const p = buildFixtures(table.slice(1), mapping, { ownName: "viitorul cluj", defaultTime: "11:00", timezone: "Europe/Bucharest", fallbackYear: 2026 });
    expect(p.others).toBe(1);
    expect(p.invalid).toEqual([{ line: 4, reason: "badDate" }]);
    expect(p.ours.map((o) => [o.round, o.date, o.time, o.isHome])).toEqual([["9", "2026-10-17", "10:00", false], ["9", "2026-10-18", "11:00", true]]);
    expect(p.payload[1]).toMatchObject({ starts_at: "2026-10-18T08:00:00.000Z", home_goals: "2", away_goals: "1" });
  });
  it("citește datele în formate uzuale", () => {
    expect(parseFixtureDate("sâm. 17.10.2026 10:30")).toEqual({ date: "2026-10-17", time: "10:30" });
    expect(parseFixtureDate("2026-10-17")).toEqual({ date: "2026-10-17", time: null });
    expect(parseFixtureDate("31.02.2026")).toBeNull();
    expect(parseMatchScore("3 – 0")).toEqual([3, 0]);
    expect(parseMatchScore("-")).toBeNull();
  });
});

describe("import clasament", () => {
  it("citește golaverajul combinat și punctele", () => {
    const t = parsePastedTable("Loc;Echipa;J;V;E;Î;Golaveraj;Pct\n1;CS Nord;8;6;2;0;20-5;20\n2;Viitorul Cluj;8;6;0;2;18-9;18");
    const rows = buildStandings(t.slice(1), guessStandingMapping(t[0]));
    expect(rows[1]).toEqual({ position: 2, team: "Viitorul Cluj", played: 8, won: 6, drawn: 0, lost: 2, goals_for: 18, goals_against: 9, points: 18 });
  });
});
