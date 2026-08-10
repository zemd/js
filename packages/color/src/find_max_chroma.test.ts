import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { find_max_chroma } from "./find_max_chroma.ts";

void describe("find_max_chroma", () => {
  void it("finds stable positive chroma for known lightness and hue", () => {
    assert.ok(Math.abs(find_max_chroma({ L: 0.5, h: 40 }) - 0.15690744224771497) < 0.5 * 10 ** -10);
    assert.ok(
      Math.abs(find_max_chroma({ L: 0.75, h: 220 }) - 0.13653862789636598) < 0.5 * 10 ** -10,
    );
  });

  void it("handles lightness outside 0-1 via clamping", () => {
    assert.strictEqual(find_max_chroma({ L: -0.2, h: 40 }), 0);
    assert.ok(Math.abs(find_max_chroma({ L: 1.2, h: 40 }) - 0) < 0.5 * 10 ** -10);
  });

  void it("clamps extreme finite lightness values before calculating the gamut line", () => {
    assert.strictEqual(find_max_chroma({ L: -Number.MAX_VALUE, h: 40 }), 0);
    assert.strictEqual(find_max_chroma({ L: Number.MAX_VALUE, h: 40 }), 0);
  });
});
