import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { oklab_to_linear_srgb } from "./oklab_to_linear_srgb.ts";

void describe("oklab_to_linear_srgb", () => {
  void it("converts OKLab white to linear white", () => {
    const color = oklab_to_linear_srgb({ L: 1, a: 0, b: 0 });

    assert.ok(Math.abs(color.r - 1) < 0.5 * 10 ** -9);
    assert.ok(Math.abs(color.g - 1) < 0.5 * 10 ** -10);
    assert.ok(Math.abs(color.b - 1) < 0.5 * 10 ** -10);
  });

  void it("converts OKLab red reference to linear red", () => {
    const color = oklab_to_linear_srgb({
      L: 0.6279553606145516,
      a: 0.22486306106597398,
      b: 0.1258462985307351,
    });

    assert.ok(Math.abs(color.r - 1) < 0.5 * 10 ** -9);
    assert.ok(Math.abs(color.g - 0) < 0.5 * 10 ** -8);
    assert.ok(Math.abs(color.b - 0) < 0.5 * 10 ** -7);
  });
});
