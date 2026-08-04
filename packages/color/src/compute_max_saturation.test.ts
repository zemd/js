import { describe, expect, it } from "vitest";
import { compute_max_saturation } from "./compute_max_saturation";

describe("compute_max_saturation", () => {
  it("computes a red-branch saturation", () => {
    expect(compute_max_saturation({ a: -1, b: 0 })).toBeCloseTo(0.181429918185984, 10);
  });

  it("computes a green-branch saturation", () => {
    expect(compute_max_saturation({ a: 1, b: 0 })).toBeCloseTo(0.4053912761182488, 10);
  });

  it("computes a blue-branch saturation", () => {
    expect(compute_max_saturation({ a: 0, b: 1 })).toBeCloseTo(0.20435727169833598, 10);
  });
});
