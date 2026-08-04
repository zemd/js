import { describe, expect, it } from "vitest";
import { srgb_to_linear_srgb } from "./srgb_to_linear_srgb";

describe("srgb_to_linear_srgb", () => {
  it("converts black and white", () => {
    expect(srgb_to_linear_srgb({ r: 0, g: 0, b: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(srgb_to_linear_srgb({ r: 255, g: 255, b: 255 })).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("converts a known mid-channel value", () => {
    const color = srgb_to_linear_srgb({ r: 128, g: 0, b: 0 });

    expect(color.r).toBeCloseTo(0.21586050011389926, 10);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0);
  });
});
