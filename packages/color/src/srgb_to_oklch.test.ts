import { describe, expect, it } from "vitest";
import { srgb_to_oklch } from "./srgb_to_oklch";

describe("srgb_to_oklch", () => {
  it("converts white to near-neutral OKLCH", () => {
    const color = srgb_to_oklch({ r: 255, g: 255, b: 255 });

    expect(color.L).toBeCloseTo(1, 7);
    expect(color.c).toBeCloseTo(0, 7);
  });

  it("converts red to a stable OKLCH reference", () => {
    const color = srgb_to_oklch({ r: 255, g: 0, b: 0 });

    expect(color.L).toBeCloseTo(0.6279553606145516, 10);
    expect(color.c).toBeCloseTo(0.2576833077361567, 10);
    expect(color.h).toBeCloseTo(29.233885192342633, 10);
  });
});
