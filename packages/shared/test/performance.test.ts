import { describe, expect, it } from "vitest";
import { CATEGORIES, STANDARD_BATTERIES, STANDARD_TEMPLATES, percentileOf } from "../src";

describe("percentila în echipă", () => {
  it("mai mare e mai bine", () => {
    expect(percentileOf(40, [30, 35, 40, 45, 50], false)).toBe(50);
    expect(percentileOf(50, [30, 35, 40, 45, 50], false)).toBe(100);
    expect(percentileOf(30, [30, 35, 40, 45, 50], false)).toBe(0);
  });
  it("mai mic e mai bine (sprint)", () => {
    expect(percentileOf(1.8, [1.8, 1.9, 2.0], true)).toBe(100);
  });
  it("egalitățile contează pe jumătate", () => {
    expect(percentileOf(5, [5, 5, 1], false)).toBe(75);
  });
  it("sub 3 rezultate nu se calculează", () => {
    expect(percentileOf(5, [5, 6], false)).toBeNull();
  });
});

describe("datele standard", () => {
  it("codurile testelor sunt unice în fiecare baterie", () => {
    for (const b of STANDARD_BATTERIES) expect(new Set(b.tests.map((x) => x.code)).size).toBe(b.tests.length);
  });
  it("modelele au criterii doar din cele patru categorii", () => {
    for (const t of STANDARD_TEMPLATES) for (const c of t.criteria) expect(CATEGORIES).toContain(c.category);
  });
});
