import { describe, expect, it } from "vitest";
import { find_gamut_intersection } from "./find_gamut_intersection";

describe("find_gamut_intersection", () => {
  it("finds lower gamut intersection", () => {
    const t = find_gamut_intersection({
      direction: { a: 1, b: 0 },
      line: { originLightness: 0.5, targetLightness: 0.4, targetChroma: 0.3 },
    });

    expect(t).toBeCloseTo(0.5952198194686572, 10);
  });

  it("finds upper gamut intersection", () => {
    const t = find_gamut_intersection({
      direction: { a: 1, b: 0 },
      line: { originLightness: 0.5, targetLightness: 0.9, targetChroma: 0.3 },
    });

    expect(t).toBeCloseTo(0.5894906902453059, 10);
  });
});
