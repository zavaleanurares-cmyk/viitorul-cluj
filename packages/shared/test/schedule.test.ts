import { describe, expect, it } from "vitest";
import { formatEventWhen, localDate, localTime, zonedToUtc, formationsFor, FORMATIONS } from "../src/schedule";

describe("ore în fusul clubului", () => {
  it("convertește ora de vară (UTC+3)", () => {
    expect(zonedToUtc("2026-10-15", "17:30")).toBe("2026-10-15T14:30:00.000Z");
  });
  it("convertește ora de iarnă (UTC+2)", () => {
    expect(zonedToUtc("2026-11-05", "17:30")).toBe("2026-11-05T15:30:00.000Z");
  });
  it("trece corect peste schimbarea orei (25 oct. 2026)", () => {
    expect(zonedToUtc("2026-10-25", "10:00")).toBe("2026-10-25T08:00:00.000Z");
    expect(zonedToUtc("2026-10-24", "10:00")).toBe("2026-10-24T07:00:00.000Z");
  });
  it("citește ziua și ora locale", () => {
    expect(localDate("2026-10-15T21:30:00Z")).toBe("2026-10-16");
    expect(localTime("2026-10-15T14:30:00Z")).toBe("17:30");
  });
  it("formatează intervalul evenimentului", () => {
    expect(formatEventWhen("2026-10-15T14:30:00Z", "2026-10-15T16:00:00Z")).toBe("joi, 15 octombrie · 17:30–19:00");
  });
});

describe("formații", () => {
  it("fiecare formație are atâtea posturi câți jucători", () => {
    for (const [name, slots] of Object.entries(FORMATIONS)) {
      const n = /\((\d+)\)/.exec(name)?.[1];
      expect(slots.length).toBe(n ? Number(n) : 11);
    }
    expect(formationsFor(9)).toEqual(["3-2-3 (9)", "3-3-2 (9)"]);
  });
});
