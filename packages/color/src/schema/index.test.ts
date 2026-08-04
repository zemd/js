import { describe, expect, it } from "vitest";
import {
  GamutCuspSchema,
  GamutLineSchema,
  HueDirectionSchema,
  LchSchema,
  MaxChromaSchema,
  OklabSchema,
  RGBSchema,
} from "./";

describe("color schemas", () => {
  it("accepts valid public color inputs", () => {
    expect(RGBSchema.safeParse({ r: 12, g: 34, b: 56 }).success).toBe(true);
    expect(LchSchema.safeParse({ L: 0.5, c: 0.2, h: 180 }).success).toBe(true);
    expect(HueDirectionSchema.safeParse({ a: 0.6, b: 0.8 }).success).toBe(true);
    expect(
      GamutLineSchema.safeParse({
        originLightness: 0.5,
        targetLightness: 0.7,
        targetChroma: 0.2,
      }).success,
    ).toBe(true);
    expect(MaxChromaSchema.safeParse({ L: 0.6, h: 270 }).success).toBe(true);
    expect(GamutCuspSchema.safeParse({ L: 0.7, C: 0.25 }).success).toBe(true);
  });

  it("rejects bounded values outside their public ranges", () => {
    expect(RGBSchema.safeParse({ r: -1, g: 0, b: 0 }).success).toBe(false);
    expect(RGBSchema.safeParse({ r: 0, g: 256, b: 0 }).success).toBe(false);
    expect(LchSchema.safeParse({ L: -0.01, c: 0, h: 0 }).success).toBe(false);
    expect(LchSchema.safeParse({ L: 1.01, c: 0, h: 0 }).success).toBe(false);
    expect(LchSchema.safeParse({ L: 0.5, c: -0.01, h: 0 }).success).toBe(false);
    expect(LchSchema.safeParse({ L: 0.5, c: 0, h: 361 }).success).toBe(false);
  });

  it("accepts normal OKLab axis values without bounding them", () => {
    expect(OklabSchema.safeParse({ L: 0.6, a: -0.2, b: 0.15 }).success).toBe(true);
  });
});
