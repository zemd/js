import { describe, expect, it } from "vitest";
import { oklab_to_srgb } from "./oklab_to_srgb";
import { srgb_to_oklab } from "./srgb_to_oklab";

describe("srgb_to_oklab", () => {
  it("converts black and white", () => {
    expect(srgb_to_oklab({ r: 0, g: 0, b: 0 })).toEqual({ L: 0, a: 0, b: 0 });

    const white = srgb_to_oklab({ r: 255, g: 255, b: 255 });
    expect(white.L).toBeCloseTo(1, 7);
    expect(white.a).toBeCloseTo(0, 7);
    expect(white.b).toBeCloseTo(0, 7);
  });

  it("round-trips a primary color", () => {
    expect(oklab_to_srgb(srgb_to_oklab({ r: 0, g: 255, b: 0 }))).toEqual({
      r: 0,
      g: 255,
      b: 0,
    });
  });
});
