import { describe, expect, it } from "vitest";
import {
  decodeSrgbChannel,
  encodeLinearSrgbChannel,
  encodeLinearSrgbChannelTo8Bit,
} from "./utils.js";

describe("sRGB channel utilities", () => {
  it("decodes channel endpoints", () => {
    expect(decodeSrgbChannel(0)).toBe(0);
    expect(decodeSrgbChannel(255)).toBe(1);
  });

  it("decodes monotonically around the sRGB threshold", () => {
    expect(decodeSrgbChannel(11)).toBeGreaterThan(decodeSrgbChannel(10));
  });

  it("encodes linear channel endpoints", () => {
    expect(encodeLinearSrgbChannel(0)).toBe(0);
    expect(encodeLinearSrgbChannel(1)).toBeCloseTo(1, 15);
  });

  it("rounds and clamps to 8-bit sRGB", () => {
    expect(encodeLinearSrgbChannelTo8Bit(-0.1)).toBe(0);
    expect(encodeLinearSrgbChannelTo8Bit(1.1)).toBe(255);
    expect(encodeLinearSrgbChannelTo8Bit(0.5)).toBe(188);
  });

  it("clamps channels before converting them to 8-bit integers", () => {
    expect(encodeLinearSrgbChannelTo8Bit(-Number.MAX_VALUE)).toBe(0);
    expect(encodeLinearSrgbChannelTo8Bit(Number.MAX_VALUE)).toBe(255);
  });
});
