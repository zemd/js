import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { find_cusp } from "./find_cusp.ts";

void describe("find_cusp", () => {
  void it("finds a stable gamut cusp for a normalized direction", () => {
    const cusp = find_cusp({ a: 1, b: 0 });

    assert.ok(Math.abs(cusp.L - 0.6477039825485499) < 0.5 * 10 ** -10);
    assert.ok(Math.abs(cusp.C - 0.2625735440322286) < 0.5 * 10 ** -10);
  });

  void it("returns positive finite cusp values", () => {
    const cusp = find_cusp({ a: 0.6, b: 0.8 });

    assert.strictEqual(Number.isFinite(cusp.L), true);
    assert.strictEqual(Number.isFinite(cusp.C), true);
    assert.ok(cusp.L > 0);
    assert.ok(cusp.C > 0);
  });
});
