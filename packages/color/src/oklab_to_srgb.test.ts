import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { oklab_to_srgb } from "./oklab_to_srgb.ts";
import { srgb_to_oklab } from "./srgb_to_oklab.ts";

void describe("oklab_to_srgb", () => {
  void it("converts black and white", () => {
    assert.deepStrictEqual(oklab_to_srgb({ L: 0, a: 0, b: 0 }), { r: 0, g: 0, b: 0 });
    assert.deepStrictEqual(oklab_to_srgb({ L: 1, a: 0, b: 0 }), { r: 255, g: 255, b: 255 });
  });

  void it("round-trips a primary color", () => {
    assert.deepStrictEqual(oklab_to_srgb(srgb_to_oklab({ r: 0, g: 0, b: 255 })), {
      r: 0,
      g: 0,
      b: 255,
    });
  });
});
