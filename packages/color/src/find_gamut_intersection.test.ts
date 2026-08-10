import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { find_gamut_intersection } from "./find_gamut_intersection.ts";

void describe("find_gamut_intersection", () => {
  void it("finds lower gamut intersection", () => {
    const t = find_gamut_intersection({
      direction: { a: 1, b: 0 },
      line: { originLightness: 0.5, targetLightness: 0.4, targetChroma: 0.3 },
    });

    assert.ok(Math.abs(t - 0.5952198194686572) < 0.5 * 10 ** -10);
  });

  void it("finds upper gamut intersection", () => {
    const t = find_gamut_intersection({
      direction: { a: 1, b: 0 },
      line: { originLightness: 0.5, targetLightness: 0.9, targetChroma: 0.3 },
    });

    assert.ok(Math.abs(t - 0.5894906902453059) < 0.5 * 10 ** -10);
  });
});
