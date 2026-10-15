import { describe, expect, it } from "vitest";
import { acuteChronicRatio, acwrSeries, acwrZone, addDays } from "../src";

const today = "2026-10-15";
/** încărcare constantă `per` în fiecare zi din ultimele `days` zile */
const steady = (days: number, per: number) => Object.fromEntries(Array.from({ length: days }, (_, i) => [addDays(today, -i), per]));

describe("raportul acut:cronic", () => {
  it("încărcarea constantă dă 1", () => {
    const r = acuteChronicRatio(steady(28, 300), today);
    expect(r.acute).toBe(2100);
    expect(r.chronic).toBe(2100);
    expect(r.ratio).toBe(1);
  });
  it("o săptămână dublă dă peste 1,5 (risc)", () => {
    const loads = { ...steady(28, 300), ...steady(7, 600) };
    const r = acuteChronicRatio(loads, today);
    expect(r.ratio).toBeCloseTo(1.6, 1);
    expect(acwrZone(r.ratio)).toBe("high");
  });
  it("fără 3 săptămâni de istoric nu dă raport", () => {
    expect(acuteChronicRatio(steady(14, 300), today).ratio).toBeNull();
    expect(acwrZone(null)).toBe("unknown");
  });
  it("zonele au pragurile 0,8 / 1,3 / 1,5", () => {
    expect(acwrZone(0.79)).toBe("low");
    expect(acwrZone(0.8)).toBe("optimal");
    expect(acwrZone(1.3)).toBe("optimal");
    expect(acwrZone(1.31)).toBe("caution");
    expect(acwrZone(1.5)).toBe("caution");
    expect(acwrZone(1.51)).toBe("high");
  });
  it("seria zilnică nu se uită în viitor", () => {
    const loads = { ...steady(40, 300), [addDays(today, -3)]: 3000 };
    const s = acwrSeries(loads, addDays(today, -6), today);
    expect(s).toHaveLength(7);
    expect(s[0].ratio).toBe(1); // înainte de vârf
    expect(s[3].load).toBe(3000);
    expect(s[3].ratio!).toBeGreaterThan(1.3);
  });
});
