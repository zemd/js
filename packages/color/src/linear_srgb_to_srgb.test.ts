import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { linear_srgb_to_srgb } from "./linear_srgb_to_srgb.ts";

void describe("linear_srgb_to_srgb", () => {
  void it("converts black and white", () => {
    assert.deepStrictEqual(linear_srgb_to_srgb({ r: 0, g: 0, b: 0 }), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(linear_srgb_to_srgb({ r: 1, g: 1, b: 1 }), { r: 255, g: 255, b: 255 });
  });

  void it("rounds normal linear values to 8-bit sRGB", () => {
    assert.deepStrictEqual(linear_srgb_to_srgb({ r: 0.5, g: 0.25, b: 0.75 }), {
      r: 188,
      g: 137,
      b: 225,
    });
  });

  void it("clamps out-of-range linear values to 8-bit sRGB", () => {
    assert.deepStrictEqual(linear_srgb_to_srgb({ r: -0.1, g: 1.1, b: 0 }), { r: 0, g: 255, b: 0 });
  });
});
