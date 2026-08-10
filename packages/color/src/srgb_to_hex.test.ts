import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { srgb_to_hex } from "./srgb_to_hex.ts";

void describe("srgb_to_hex", () => {
  void it("converts black and white", () => {
    assert.strictEqual(srgb_to_hex({ r: 0, g: 0, b: 0 }), "000000");
    assert.strictEqual(srgb_to_hex({ r: 255, g: 255, b: 255 }), "ffffff");
  });

  void it("converts mixed channels", () => {
    assert.strictEqual(srgb_to_hex({ r: 255, g: 128, b: 0 }), "ff8000");
  });
});
