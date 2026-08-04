import { describe, expect, it } from "vitest";
import { oklch_to_srgb } from "./oklch_to_srgb";
import { srgb_to_oklch } from "./srgb_to_oklch";

describe("oklch_to_srgb", () => {
  it("converts a known primary OKLCH reference back to sRGB", () => {
    expect(
      oklch_to_srgb({
        L: 0.6279553606145516,
        c: 0.2576833077361567,
        h: 29.233885192342633,
      }),
    ).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("clamps out-of-gamut OKLCH values to valid sRGB", () => {
    expect(oklch_to_srgb({ L: 0.6, c: 1, h: 40 })).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("round-trips a non-neutral sRGB color through OKLCH", () => {
    expect(oklch_to_srgb(srgb_to_oklch({ r: 64, g: 128, b: 192 }))).toEqual({
      r: 64,
      g: 128,
      b: 192,
    });
  });
});
