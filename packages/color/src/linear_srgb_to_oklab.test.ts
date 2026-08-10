import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { linear_srgb_to_oklab } from "./linear_srgb_to_oklab.ts";

void describe("linear_srgb_to_oklab", () => {
  void it("converts black", () => {
    assert.deepStrictEqual(linear_srgb_to_oklab({ r: 0, g: 0, b: 0 }), { L: 0, a: 0, b: 0 });
  });

  void it("converts white", () => {
    const color = linear_srgb_to_oklab({ r: 1, g: 1, b: 1 });

    assert.ok(Math.abs(color.L - 1) < 0.5 * 10 ** -7);
    assert.ok(Math.abs(color.a - 0) < 0.5 * 10 ** -7);
    assert.ok(Math.abs(color.b - 0) < 0.5 * 10 ** -7);
  });

  void it("converts red primary to a stable OKLab reference", () => {
    const color = linear_srgb_to_oklab({ r: 1, g: 0, b: 0 });

    assert.ok(Math.abs(color.L - 0.6279553606145516) < 0.5 * 10 ** -10);
    assert.ok(Math.abs(color.a - 0.22486306106597398) < 0.5 * 10 ** -10);
    assert.ok(Math.abs(color.b - 0.1258462985307351) < 0.5 * 10 ** -10);
  });
});
