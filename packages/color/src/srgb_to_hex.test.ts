import { describe, expect, it } from "vitest";
import { srgb_to_hex } from "./srgb_to_hex";

describe("srgb_to_hex", () => {
  it("converts black and white", () => {
    expect(srgb_to_hex({ r: 0, g: 0, b: 0 })).toBe("000000");
    expect(srgb_to_hex({ r: 255, g: 255, b: 255 })).toBe("ffffff");
  });

  it("converts mixed channels", () => {
    expect(srgb_to_hex({ r: 255, g: 128, b: 0 })).toBe("ff8000");
  });
});
