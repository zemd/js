import { describe, expect, it } from "vitest";
import { find_cusp } from "./find_cusp";

describe("find_cusp", () => {
  it("finds a stable gamut cusp for a normalized direction", () => {
    const cusp = find_cusp({ a: 1, b: 0 });

    expect(cusp.L).toBeCloseTo(0.6477039825485499, 10);
    expect(cusp.C).toBeCloseTo(0.2625735440322286, 10);
  });

  it("returns positive finite cusp values", () => {
    const cusp = find_cusp({ a: 0.6, b: 0.8 });

    expect(Number.isFinite(cusp.L)).toBe(true);
    expect(Number.isFinite(cusp.C)).toBe(true);
    expect(cusp.L).toBeGreaterThan(0);
    expect(cusp.C).toBeGreaterThan(0);
  });
});
