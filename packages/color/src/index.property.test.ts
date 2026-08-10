import fc from "fast-check";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
} from "./index.ts";

const channel = fc.integer({ min: 0, max: 255 });
const rgb = fc.record<RGB>({ r: channel, g: channel, b: channel });
const unitInterval = fc.double({ min: 0, max: 1, noNaN: true });
const hue = fc.double({ min: 0, max: 360, noNaN: true });
const finiteChannel = fc.double({ noNaN: true, noDefaultInfinity: true });

void describe("sRGB conversions", () => {
  void it("formats every 8-bit color as a six-digit hexadecimal value", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const expected = [color.r, color.g, color.b]
          .map((value) => {
            return value.toString(16).padStart(2, "0");
          })
          .join("");

        assert.strictEqual(srgb_to_hex(color), expected);
      }),
      { numRuns: 5000 },
    );
  });

  void it("round trips every generated 8-bit color through linear sRGB", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const expected: RGB = { r: color.r, g: color.g, b: color.b };

        assert.deepStrictEqual(linear_srgb_to_srgb(srgb_to_linear_srgb(color)), expected);
      }),
      { numRuns: 5000 },
    );
  });

  void it("round trips every generated 8-bit color through OKLab", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const expected: RGB = { r: color.r, g: color.g, b: color.b };

        assert.deepStrictEqual(oklab_to_srgb(srgb_to_oklab(color)), expected);
      }),
      { numRuns: 5000 },
    );
  });

  void it("round trips every generated 8-bit color through OKLCH", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const expected: RGB = { r: color.r, g: color.g, b: color.b };

        assert.deepStrictEqual(oklch_to_srgb(srgb_to_oklch(color)), expected);
      }),
      { numRuns: 5000 },
    );
  });

  void it("always emits valid OKLCH coordinates", () => {
    fc.assert(
      fc.property(rgb, (color) => {
        const converted = srgb_to_oklch(color);

        assert.strictEqual(Number.isFinite(converted.L), true);
        assert.strictEqual(Number.isFinite(converted.c), true);
        assert.strictEqual(Number.isFinite(converted.h), true);
        assert.ok(converted.L >= 0);
        assert.ok(converted.L <= 1);
        assert.ok(converted.c >= 0);
        assert.ok(converted.h >= 0);
        assert.ok(converted.h <= 360);
      }),
      { numRuns: 5000 },
    );
  });
});

void describe("out-of-gamut conversion", () => {
  void it("clamps every finite linear channel to an 8-bit channel", () => {
    fc.assert(
      fc.property(finiteChannel, (value) => {
        const encoded = encodeLinearSrgbChannelTo8Bit(value);

        assert.strictEqual(Number.isInteger(encoded), true);
        assert.ok(encoded >= 0);
        assert.ok(encoded <= 255);
        if (value <= 0) {
          assert.strictEqual(encoded, 0);
        }
        if (value >= 1) {
          assert.strictEqual(encoded, 255);
        }
      }),
      { numRuns: 5000 },
    );
  });
});

void describe("sRGB gamut boundary", () => {
  void it("finds a finite positive cusp for every hue", () => {
    fc.assert(
      fc.property(hue, (h) => {
        const radians = h * (Math.PI / 180);
        const direction = { a: Math.cos(radians), b: Math.sin(radians) };
        const saturation = compute_max_saturation(direction);
        const cusp = find_cusp(direction);

        assert.strictEqual(Number.isFinite(saturation), true);
        assert.ok(saturation > 0);
        assert.strictEqual(Number.isFinite(cusp.L), true);
        assert.strictEqual(Number.isFinite(cusp.C), true);
        assert.ok(cusp.L > 0);
        assert.ok(cusp.L <= 1);
        assert.ok(cusp.C > 0);
      }),
      { numRuns: 5000 },
    );
  });

  void it("finds a finite non-negative maximum chroma", () => {
    fc.assert(
      fc.property(unitInterval, hue, (L, h) => {
        const chroma = find_max_chroma({ L, h });

        assert.strictEqual(Number.isFinite(chroma), true);
        assert.ok(chroma >= 0);
      }),
      { numRuns: 5000 },
    );
  });

  void it("treats 0 and 360 degrees as the same hue", () => {
    fc.assert(
      fc.property(unitInterval, (L) => {
        assert.ok(
          Math.abs(find_max_chroma({ L, h: 360 }) - find_max_chroma({ L, h: 0 })) < 0.5 * 10 ** -12,
        );
      }),
      { numRuns: 2000 },
    );
  });

  void it("clamps lightness before finding the boundary", () => {
    fc.assert(
      fc.property(finiteChannel, hue, (L, h) => {
        const clampedLightness = Math.min(Math.max(L, 0), 1);
        const expected = find_max_chroma({ L: clampedLightness, h });

        assert.ok(Math.abs(find_max_chroma({ L, h }) - expected) < 0.5 * 10 ** -12);
      }),
      { numRuns: 5000 },
    );
  });
});
