import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { oklch_to_srgb } from "./oklch_to_srgb.ts";
import { srgb_to_oklch } from "./srgb_to_oklch.ts";

void describe("oklch_to_srgb", () => {
  void it("converts a known primary OKLCH reference back to sRGB", () => {
    assert.deepStrictEqual(
      oklch_to_srgb({
        L: 0.6279553606145516,
        c: 0.2576833077361567,
        h: 29.233885192342633,
      }),
      { r: 255, g: 0, b: 0 },
    );
  });

  void it("clamps out-of-gamut OKLCH values to valid sRGB", () => {
    assert.deepStrictEqual(oklch_to_srgb({ L: 0.6, c: 1, h: 40 }), { r: 255, g: 0, b: 0 });
  });

  void it("round-trips a non-neutral sRGB color through OKLCH", () => {
    assert.deepStrictEqual(oklch_to_srgb(srgb_to_oklch({ r: 64, g: 128, b: 192 })), {
      r: 64,
      g: 128,
      b: 192,
    });
  });
});
