import { describe, expect, it } from "vitest";
import { linear_srgb_to_oklab } from "./linear_srgb_to_oklab";

describe("linear_srgb_to_oklab", () => {
  it("converts black", () => {
    expect(linear_srgb_to_oklab({ r: 0, g: 0, b: 0 })).toEqual({ L: 0, a: 0, b: 0 });
  });

  it("converts white", () => {
    const color = linear_srgb_to_oklab({ r: 1, g: 1, b: 1 });

    expect(color.L).toBeCloseTo(1, 7);
    expect(color.a).toBeCloseTo(0, 7);
    expect(color.b).toBeCloseTo(0, 7);
  });

  it("converts red primary to a stable OKLab reference", () => {
    const color = linear_srgb_to_oklab({ r: 1, g: 0, b: 0 });

    expect(color.L).toBeCloseTo(0.6279553606145516, 10);
    expect(color.a).toBeCloseTo(0.22486306106597398, 10);
    expect(color.b).toBeCloseTo(0.1258462985307351, 10);
  });
});
