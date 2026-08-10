import type { LinearRGB, RGB } from "./schema/index.ts";
import { decodeSrgbChannel } from "./utils.ts";

export const srgb_to_linear_srgb = (color: RGB): LinearRGB => {
  return {
    r: decodeSrgbChannel(color.r),
    g: decodeSrgbChannel(color.g),
    b: decodeSrgbChannel(color.b),
  };
};
