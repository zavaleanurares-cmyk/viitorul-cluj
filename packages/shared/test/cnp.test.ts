import { describe, expect, it } from "vitest";
import { isValidCnp } from "../src";

describe("isValidCnp", () => {
  it("acceptă un CNP cu cifra de control corectă", () => {
    expect(isValidCnp("1800101420010")).toBe(true);
  });
  it("respinge cifra de control greșită, lungimea greșită și literele", () => {
    expect(isValidCnp("1800101420011")).toBe(false);
    expect(isValidCnp("180010142001")).toBe(false);
    expect(isValidCnp("18001014200a0")).toBe(false);
  });
});
