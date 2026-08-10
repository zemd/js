import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compute_max_saturation } from "./compute_max_saturation.ts";

void describe("compute_max_saturation", () => {
  void it("computes a red-branch saturation", () => {
    assert.ok(
      Math.abs(compute_max_saturation({ a: -1, b: 0 }) - 0.181429918185984) < 0.5 * 10 ** -10,
    );
  });

  void it("computes a green-branch saturation", () => {
    assert.ok(
      Math.abs(compute_max_saturation({ a: 1, b: 0 }) - 0.4053912761182488) < 0.5 * 10 ** -10,
    );
  });

  void it("computes a blue-branch saturation", () => {
    assert.ok(
      Math.abs(compute_max_saturation({ a: 0, b: 1 }) - 0.20435727169833598) < 0.5 * 10 ** -10,
    );
  });
});
