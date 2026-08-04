import { describe, expect, it } from "vitest";
import { oklab_to_srgb } from "./oklab_to_srgb";
import { srgb_to_oklab } from "./srgb_to_oklab";

describe("oklab_to_srgb", () => {
  it("converts black and white", () => {
    expect(oklab_to_srgb({ L: 0, a: 0, b: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(oklab_to_srgb({ L: 1, a: 0, b: 0 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("round-trips a primary color", () => {
    expect(oklab_to_srgb(srgb_to_oklab({ r: 0, g: 0, b: 255 }))).toEqual({
      r: 0,
      g: 0,
      b: 255,
    });
  });
});
