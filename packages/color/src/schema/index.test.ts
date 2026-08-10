import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GamutCuspSchema,
  GamutLineSchema,
  HueDirectionSchema,
  LchSchema,
  MaxChromaSchema,
  OklabSchema,
  RGBSchema,
} from "./index.ts";

void describe("color schemas", () => {
  void it("accepts valid public color inputs", () => {
    assert.strictEqual(RGBSchema.safeParse({ r: 12, g: 34, b: 56 }).success, true);
    assert.strictEqual(LchSchema.safeParse({ L: 0.5, c: 0.2, h: 180 }).success, true);
    assert.strictEqual(HueDirectionSchema.safeParse({ a: 0.6, b: 0.8 }).success, true);
    assert.strictEqual(
      GamutLineSchema.safeParse({
        originLightness: 0.5,
        targetLightness: 0.7,
        targetChroma: 0.2,
      }).success,
      true,
    );
    assert.strictEqual(MaxChromaSchema.safeParse({ L: 0.6, h: 270 }).success, true);
    assert.strictEqual(GamutCuspSchema.safeParse({ L: 0.7, C: 0.25 }).success, true);
  });

  void it("rejects bounded values outside their public ranges", () => {
    assert.strictEqual(RGBSchema.safeParse({ r: -1, g: 0, b: 0 }).success, false);
    assert.strictEqual(RGBSchema.safeParse({ r: 0, g: 256, b: 0 }).success, false);
    assert.strictEqual(LchSchema.safeParse({ L: -0.01, c: 0, h: 0 }).success, false);
    assert.strictEqual(LchSchema.safeParse({ L: 1.01, c: 0, h: 0 }).success, false);
    assert.strictEqual(LchSchema.safeParse({ L: 0.5, c: -0.01, h: 0 }).success, false);
    assert.strictEqual(LchSchema.safeParse({ L: 0.5, c: 0, h: 361 }).success, false);
  });

  void it("accepts normal OKLab axis values without bounding them", () => {
    assert.strictEqual(OklabSchema.safeParse({ L: 0.6, a: -0.2, b: 0.15 }).success, true);
  });
});
