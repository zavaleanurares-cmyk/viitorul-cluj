import { describe, expect, it } from "vitest";
import {
  detectTfbFile, leiToBani, methodOf, packTfbBundle, parseCsv, parseTfbFiles, planTfbImport, proposeTfb, tfbKey, unpackTfbBundle,
  type TfbSnapshot,
} from "../src";

const TODAY = "2026-10-15";
const GREEN = "rgba(63, 195, 128, 0.9)";
const RED = "rgba(242, 38, 19, 0.9)";
const NONE = "rgba(0, 0, 0, 0)";

/** Un rând din grila plăților: 12 luni (text, culoare). */
function payRow(year: number, block: string, fee: string, cells: Record<number, [string, string]>): string[] {
  const out = [String(year), block, fee];
  for (let m = 1; m <= 12; m++) out.push(...(cells[m] ?? ["-", NONE]));
  return out;
}
const payHead = ["an", "nume_bloc", "taxa_lunara", ...Array.from({ length: 12 }, (_, i) => [`l${i + 1}_text`, `l${i + 1}_culoare`]).flat()];

function files() {
  return [
    {
      name: "echipe.csv",
      rows: [
        ["0", "Nume echipa", "Sezon", "Tip", "Jucatori", "Antrenor"],
        ["0", "U15 (2012) ELITE", "2026/2027", "Competitie", "2", "Ion Antrenor"],
        ["0", "Liga 3", "2026/2027", "Competitie", "1", "Alt Antrenor"],
        ["1", "Nume", "Rol", "Licenta"],
        ["1", "Ion Antrenor", "Antrenor principal", "UEFA B"],
      ],
    },
    {
      name: "jucatori-echipe.csv",
      rows: [
        ["Nume", "Pozitie", "Varsta nastere", "Echipe"],
        ["Pop Bogdan", "Forward", "14 14.05.2012", "U15 (2012) ELITE"],
        ["Ionescu Matei Andrei", "Goalkeeper", "14 01.02.2012", "U15 (2012) ELITE|Liga 3"],
      ],
    },
    {
      name: "plati-2026.csv",
      rows: [
        payHead,
        payRow(2026, "Pop Bogdan | 1700 | U15 (2012) ELITE", "450", { 9: ["450 transfer bancar", GREEN], 10: ["450", RED], 11: ["450", NONE] }),
        payRow(2026, "Ionescu Matei Andrei | 1800 | U15 (2012) ELITE", "400", { 9: ["400 aplicație mobilă", GREEN], 10: ["400 numerar", GREEN] }),
      ],
    },
    {
      name: "plati-2025.csv",
      rows: [
        payHead,
        payRow(2025, "Pop Bogdan | 1700 | U15 (2012) ELITE", "450", { 12: ["450 transfer bancar", GREEN] }),
        // omonim: alt număr matricol, plătește separat
        payRow(2025, "POP Bogdan | 2279 | Liga 3", "0", { 12: ["400 transfer bancar", GREEN] }),
      ],
    },
    {
      name: "utilizatori.csv",
      rows: [
        ["Nume", "Relatie", "Jucatori", "Telefon", "Email", "Recurent"],
        ["Maria Pop", "Mama", "Pop Bogdan", "+40 740 000 001", "maria@example.com", "da"],
        ["MATEI IONESCU", "Jucator", "Ionescu Matei Andrei", "+40740000002", "", ""],
      ],
    },
  ];
}

function emptySnap(): TfbSnapshot {
  return { today: TODAY, groups: [], players: [], guardians: [], links: [], monthly: [], paidByPeriod: [], groupPlans: [], playerPlans: [] };
}

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("TFB: fișiere", () => {
  it("recunoaște fișierele după antet", () => {
    const [teams, pt, pay2026, , users] = files();
    expect(detectTfbFile(teams.rows)?.kind).toBe("teams_staff");
    expect(detectTfbFile(pt.rows)?.kind).toBe("player_teams");
    expect(detectTfbFile(pay2026.rows)).toEqual({ kind: "payments", year: 2026 });
    expect(detectTfbFile(users.rows)?.kind).toBe("app_users");
    expect(detectTfbFile([["ceva", "altceva"]])).toBeNull();
  });

  it("citește sume, metode și CSV cu ghilimele", () => {
    expect(leiToBani("1.234,50")).toBe(123450);
    expect(leiToBani("450")).toBe(45000);
    expect(leiToBani("-")).toBeNull();
    expect(leiToBani("1.000")).toBe(100000);
    expect(methodOf("aplicație mobilă")).toBe("online");
    expect(methodOf("numerar")).toBe("cash");
    expect(methodOf("transfer bancar")).toBe("bank");
    expect(parseCsv('"a";"b; c"\n"1";"2"')).toEqual([["a", "b; c"], ["1", "2"]]);
    expect(tfbKey("Pop  Bogdan")).toBe(tfbKey("BOGDAN POP"));
  });

  it("separă omonimii după numărul matricol și ignoră lunile viitoare neplătite", () => {
    const b = parseTfbFiles(files(), TODAY);
    const pops = b.players.filter((p) => p.key.startsWith(tfbKey("Pop Bogdan")));
    expect(pops).toHaveLength(2);
    expect(pops.find((p) => p.matricol === "2279")?.active).toBe(false);
    const bogdan = b.months.filter((m) => m.player === tfbKey("Pop Bogdan"));
    // 12/2025 plătit, 9/2026 plătit, 10/2026 restant; 11/2026 (viitor, neplătit) nu intră
    expect(bogdan.map((m) => [m.period, m.paid])).toEqual([["2026-09-01", true], ["2026-10-01", false], ["2025-12-01", true]]);
    expect(b.staff).toHaveLength(1);
    expect(b.guardians[0]).toMatchObject({ relation: "mother", recurring: true, phone: "+40740000001" });
  });

  it("pachetul pentru server păstrează tot", () => {
    const b = parseTfbFiles(files(), TODAY);
    const back = unpackTfbBundle(packTfbBundle(b));
    expect(back.months).toEqual(b.months);
    expect(back.players).toEqual(b.players);
    expect(back.guardians).toEqual(b.guardians);
  });
});

describe("TFB: planul", () => {
  it("o lună care are deja taxă în Locker Room primește plata o singură dată", () => {
    const b = parseTfbFiles(files(), TODAY);
    const first = planTfbImport(b, emptySnap(), { groups: {}, players: {}, deactivateMissing: false }, uuid).plan;
    const bogdan = first.players.create.find((p) => p.full_name === "Pop Bogdan")!;
    const snap: TfbSnapshot = {
      ...emptySnap(),
      groups: first.groups.create.map((g) => ({ id: g.id, name: g.name, is_active: true })),
      players: [{ id: bogdan.id, full_name: bogdan.full_name, display_name: bogdan.display_name ?? "", birth_date: bogdan.birth_date, group_id: bogdan.group_id, is_active: true }],
      // taxa din septembrie 2026 a fost emisă automat, neplătită
      monthly: [{ player_id: bogdan.id, period: "2026-09-01", amount: 45000 }],
    };
    const decisions = { groups: {}, players: { [bogdan.id]: tfbKey("Pop Bogdan") }, deactivateMissing: false };
    const { plan, reconciliation } = planTfbImport(b, snap, decisions, uuid);
    expect(plan.charges.some((c) => c.player_id === bogdan.id && c.period === "2026-09-01")).toBe(false);
    expect(plan.paymentsExisting).toEqual([expect.objectContaining({ player_id: bogdan.id, period: "2026-09-01", amount: 45000, method: "bank" })]);
    expect(reconciliation.months.find((m) => m.period === "2026-09-01")?.ok).toBe(true);
    // după import, plata TFB e alocată: o nouă rulare nu o mai adaugă
    const again = planTfbImport(b, { ...snap, allocated: [{ player_id: bogdan.id, period: "2026-09-01", amount: 45000, tfb: true }] }, decisions, uuid).plan;
    expect(again.paymentsExisting).toHaveLength(0);
  });

  it("creează echipe, jucători, taxe și plăți; banii pe luni se potrivesc", () => {
    const b = parseTfbFiles(files(), TODAY);
    const snap = emptySnap();
    const proposals = proposeTfb(b, snap);
    const decisions = { groups: {}, players: Object.fromEntries(proposals.players.map((p) => [p.id, p.suggested])), deactivateMissing: false };
    const { plan, summary, reconciliation } = planTfbImport(b, snap, decisions, uuid);
    expect(plan.groups.create.map((g) => g.name).sort()).toEqual(["Liga 3", "U15 (2012) ELITE"]);
    expect(plan.players.create).toHaveLength(3);
    expect(summary.multiTeam).toEqual([{ name: "Ionescu Matei Andrei", primary: "U15 (2012) ELITE", others: ["Liga 3"] }]);
    expect(plan.payments.reduce((s, p) => s + p.amount, 0)).toBe(45000 + 40000 + 40000 + 45000 + 40000);
    expect(summary.dueTotal).toBe(45000);
    expect(reconciliation.months.every((m) => m.ok)).toBe(true);
    expect(reconciliation.teams.every((t) => t.ok)).toBe(true);
    expect(plan.guardians.link).toHaveLength(1);
    expect(plan.contacts).toHaveLength(1);
  });

  it("o nouă rulare, pe starea de după import, nu mai creează nimic", () => {
    const b = parseTfbFiles(files(), TODAY);
    const first = planTfbImport(b, emptySnap(), { groups: {}, players: {}, deactivateMissing: false }, uuid).plan;
    // starea de după: ce a scris primul plan
    const after: TfbSnapshot = {
      ...emptySnap(),
      groups: first.groups.create.map((g) => ({ id: g.id, name: g.name, is_active: true })),
      players: first.players.create.map((p) => ({ id: p.id, full_name: p.full_name, display_name: p.display_name ?? p.full_name, birth_date: p.birth_date, group_id: p.group_id, is_active: p.is_active })),
      guardians: first.guardians.create,
      links: first.guardians.link,
      monthly: first.charges.map((c) => ({ player_id: c.player_id, period: c.period })),
      paidByPeriod: first.payments.map((p) => ({ period: p.period, amount: p.amount })),
      groupPlans: first.feePlans.flatMap((f) => (f.group_id ? [f.group_id] : [])),
      playerPlans: first.feePlans.flatMap((f) => (f.player_id ? [f.player_id] : [])),
    };
    const proposals = proposeTfb(b, after);
    const decisions = {
      groups: Object.fromEntries(proposals.groups.map((g) => [g.id, g.suggested])),
      players: Object.fromEntries(proposals.players.map((p) => [p.id, p.suggested])),
      deactivateMissing: false,
    };
    const { plan, reconciliation } = planTfbImport(b, after, decisions, uuid);
    expect(plan.players.create).toHaveLength(0);
    expect(plan.groups.create).toHaveLength(0);
    expect(plan.guardians.create).toHaveLength(0);
    expect(plan.charges).toHaveLength(0);
    expect(plan.feePlans).toHaveLength(0);
    expect(reconciliation.months.every((m) => m.ok)).toBe(true);
  });
});
