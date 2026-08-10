import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { srgb_to_oklch } from "./srgb_to_oklch.ts";

void describe("srgb_to_oklch", () => {
  void it("converts white to near-neutral OKLCH", () => {
    const color = srgb_to_oklch({ r: 255, g: 255, b: 255 });

    assert.ok(Math.abs(color.L - 1) < 0.5 * 10 ** -7);
    assert.ok(Math.abs(color.c - 0) < 0.5 * 10 ** -7);
  });

  void it("converts red to a stable OKLCH reference", () => {
    const color = srgb_to_oklch({ r: 255, g: 0, b: 0 });

    assert.ok(Math.abs(color.L - 0.6279553606145516) < 0.5 * 10 ** -10);
    assert.ok(Math.abs(color.c - 0.2576833077361567) < 0.5 * 10 ** -10);
    assert.ok(Math.abs(color.h - 29.233885192342633) < 0.5 * 10 ** -10);
  });
});
