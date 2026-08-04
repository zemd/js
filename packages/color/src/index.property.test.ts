import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  compute_max_saturation,
  encodeLinearSrgbChannelTo8Bit,
  find_cusp,
  find_max_chroma,
  linear_srgb_to_srgb,
  oklab_to_srgb,
  oklch_to_srgb,
  srgb_to_hex,
  srgb_to_linear_srgb,
  srgb_to_oklab,
  srgb_to_oklch,
  type RGB,
} from "./index";

const channel = fc.integer({ min: 0, max: 255 });
const rgb = fc.record<RGB>({ r: channel, g: channel, b: channel });
const unitInterval = fc.double({ min: 0, max: 1, noNaN: true });
const hue = fc.double({ min: 0, max: 360, noNaN: true });
const finiteChannel = fc.double({ noNaN: true, noDefaultInfinity: true });

describe("sRGB conversions", () => {
  it("formats every 8-bit color as a six-digit hexadecimal value", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const expected = [color.r, color.g, color.b]
          .map((value) => {
            return value.toString(16).padStart(2, "0");
          })
          .join("");

        expect(srgb_to_hex(color)).toBe(expected);
      }),
      { numRuns: 5000 },
    );
  });

  it("round trips every generated 8-bit color through linear sRGB", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        expect(linear_srgb_to_srgb(srgb_to_linear_srgb(color))).toEqual(color);
      }),
      { numRuns: 5000 },
    );
  });

  it("round trips every generated 8-bit color through OKLab", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        expect(oklab_to_srgb(srgb_to_oklab(color))).toEqual(color);
      }),
      { numRuns: 5000 },
    );
  });

  it("round trips every generated 8-bit color through OKLCH", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        expect(oklch_to_srgb(srgb_to_oklch(color))).toEqual(color);
      }),
      { numRuns: 5000 },
    );
  });

  it("always emits valid OKLCH coordinates", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const converted = srgb_to_oklch(color);

        expect(Number.isFinite(converted.L)).toBe(true);
        expect(Number.isFinite(converted.c)).toBe(true);
        expect(Number.isFinite(converted.h)).toBe(true);
        expect(converted.L).toBeGreaterThanOrEqual(0);
        expect(converted.L).toBeLessThanOrEqual(1);
        expect(converted.c).toBeGreaterThanOrEqual(0);
        expect(converted.h).toBeGreaterThanOrEqual(0);
        expect(converted.h).toBeLessThanOrEqual(360);
      }),
      { numRuns: 5000 },
    );
  });
});

describe("out-of-gamut conversion", () => {
  it("clamps every finite linear channel to an 8-bit channel", () => {
    fc.assert(
      fc.property(finiteChannel, (value) => {
        const encoded = encodeLinearSrgbChannelTo8Bit(value);

        expect(Number.isInteger(encoded)).toBe(true);
        expect(encoded).toBeGreaterThanOrEqual(0);
        expect(encoded).toBeLessThanOrEqual(255);
        if (value <= 0) {
          expect(encoded).toBe(0);
        }
        if (value >= 1) {
          expect(encoded).toBe(255);
        }
      }),
      { numRuns: 5000 },
    );
  });
});

describe("sRGB gamut boundary", () => {
  it("finds a finite positive cusp for every hue", () => {
    fc.assert(
      fc.property(hue, (h) => {
        const radians = h * (Math.PI / 180);
        const direction = { a: Math.cos(radians), b: Math.sin(radians) };
        const saturation = compute_max_saturation(direction);
        const cusp = find_cusp(direction);

        expect(Number.isFinite(saturation)).toBe(true);
        expect(saturation).toBeGreaterThan(0);
        expect(Number.isFinite(cusp.L)).toBe(true);
        expect(Number.isFinite(cusp.C)).toBe(true);
        expect(cusp.L).toBeGreaterThan(0);
        expect(cusp.L).toBeLessThanOrEqual(1);
        expect(cusp.C).toBeGreaterThan(0);
      }),
      { numRuns: 5000 },
    );
  });

  it("finds a finite non-negative maximum chroma", () => {
    fc.assert(
      fc.property(unitInterval, hue, (L, h) => {
        const chroma = find_max_chroma({ L, h });

        expect(Number.isFinite(chroma)).toBe(true);
        expect(chroma).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 5000 },
    );
  });

  it("treats 0 and 360 degrees as the same hue", () => {
    fc.assert(
      fc.property(unitInterval, (L) => {
        expect(find_max_chroma({ L, h: 360 })).toBeCloseTo(find_max_chroma({ L, h: 0 }), 12);
      }),
      { numRuns: 2000 },
    );
  });

  it("clamps lightness before finding the boundary", () => {
    fc.assert(
      fc.property(finiteChannel, hue, (L, h) => {
        const clampedLightness = Math.min(Math.max(L, 0), 1);
        const expected = find_max_chroma({ L: clampedLightness, h });

        expect(find_max_chroma({ L, h })).toBeCloseTo(expected, 12);
      }),
      { numRuns: 5000 },
    );
  });
});
