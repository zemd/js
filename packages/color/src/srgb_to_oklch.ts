import type { Lch, RGB } from "./schema/index.ts";
import { srgb_to_oklab } from "./srgb_to_oklab.ts";

export const srgb_to_oklch = (color: RGB): Lch => {
  const oklab = srgb_to_oklab(color);
  const hue = Math.atan2(oklab.b, oklab.a) * (180 / Math.PI);

  return {
    L: oklab.L,
    c: Math.hypot(oklab.a, oklab.b),
    h: hue >= 0 ? hue : hue + 360,
  };
};
