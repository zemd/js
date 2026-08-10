import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { oklab_to_srgb } from "./oklab_to_srgb.ts";
import { srgb_to_oklab } from "./srgb_to_oklab.ts";

void describe("srgb_to_oklab", () => {
  void it("converts black and white", () => {
    assert.deepStrictEqual(srgb_to_oklab({ r: 0, g: 0, b: 0 }), { L: 0, a: 0, b: 0 });

    const white = srgb_to_oklab({ r: 255, g: 255, b: 255 });
    assert.ok(Math.abs(white.L - 1) < 0.5 * 10 ** -7);
    assert.ok(Math.abs(white.a - 0) < 0.5 * 10 ** -7);
    assert.ok(Math.abs(white.b - 0) < 0.5 * 10 ** -7);
  });

  void it("round-trips a primary color", () => {
    assert.deepStrictEqual(oklab_to_srgb(srgb_to_oklab({ r: 0, g: 255, b: 0 })), {
      r: 0,
      g: 255,
      b: 0,
    });
  });
});
