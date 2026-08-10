import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { srgb_to_linear_srgb } from "./srgb_to_linear_srgb.ts";

void describe("srgb_to_linear_srgb", () => {
  void it("converts black and white", () => {
    assert.deepStrictEqual(srgb_to_linear_srgb({ r: 0, g: 0, b: 0 }), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(srgb_to_linear_srgb({ r: 255, g: 255, b: 255 }), { r: 1, g: 1, b: 1 });
  });

  void it("converts a known mid-channel value", () => {
    const color = srgb_to_linear_srgb({ r: 128, g: 0, b: 0 });

    assert.ok(Math.abs(color.r - 0.21586050011389926) < 0.5 * 10 ** -10);
    assert.strictEqual(color.g, 0);
    assert.strictEqual(color.b, 0);
  });
});
