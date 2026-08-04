import { describe, expect, it } from "vitest";
import { find_max_chroma } from "./find_max_chroma";

describe("find_max_chroma", () => {
  it("finds stable positive chroma for known lightness and hue", () => {
    expect(find_max_chroma({ L: 0.5, h: 40 })).toBeCloseTo(0.15690744224771497, 10);
    expect(find_max_chroma({ L: 0.75, h: 220 })).toBeCloseTo(0.13653862789636598, 10);
  });

  it("handles lightness outside 0-1 via clamping", () => {
    expect(find_max_chroma({ L: -0.2, h: 40 })).toBe(0);
    expect(find_max_chroma({ L: 1.2, h: 40 })).toBeCloseTo(0, 10);
  });

  it("clamps extreme finite lightness values before calculating the gamut line", () => {
    expect(find_max_chroma({ L: -Number.MAX_VALUE, h: 40 })).toBe(0);
    expect(find_max_chroma({ L: Number.MAX_VALUE, h: 40 })).toBe(0);
  });
});
