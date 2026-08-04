import { describe, expect, it } from "vitest";
import { oklab_to_linear_srgb } from "./oklab_to_linear_srgb";

describe("oklab_to_linear_srgb", () => {
  it("converts OKLab white to linear white", () => {
    const color = oklab_to_linear_srgb({ L: 1, a: 0, b: 0 });

    expect(color.r).toBeCloseTo(1, 9);
    expect(color.g).toBeCloseTo(1, 10);
    expect(color.b).toBeCloseTo(1, 10);
  });

  it("converts OKLab red reference to linear red", () => {
    const color = oklab_to_linear_srgb({
      L: 0.6279553606145516,
      a: 0.22486306106597398,
      b: 0.1258462985307351,
    });

    expect(color.r).toBeCloseTo(1, 9);
    expect(color.g).toBeCloseTo(0, 8);
    expect(color.b).toBeCloseTo(0, 7);
  });
});
