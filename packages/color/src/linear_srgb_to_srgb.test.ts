import { describe, expect, it } from "vitest";
import { linear_srgb_to_srgb } from "./linear_srgb_to_srgb";

describe("linear_srgb_to_srgb", () => {
  it("converts black and white", () => {
    expect(linear_srgb_to_srgb({ r: 0, g: 0, b: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(linear_srgb_to_srgb({ r: 1, g: 1, b: 1 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("rounds normal linear values to 8-bit sRGB", () => {
    expect(linear_srgb_to_srgb({ r: 0.5, g: 0.25, b: 0.75 })).toEqual({
      r: 188,
      g: 137,
      b: 225,
    });
  });

  it("clamps out-of-range linear values to 8-bit sRGB", () => {
    expect(linear_srgb_to_srgb({ r: -0.1, g: 1.1, b: 0 })).toEqual({ r: 0, g: 255, b: 0 });
  });
});
