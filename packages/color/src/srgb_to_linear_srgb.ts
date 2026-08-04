import type { LinearRGB, RGB } from "./schema";
import { decodeSrgbChannel } from "./utils";

export const srgb_to_linear_srgb = (color: RGB): LinearRGB => {
  return {
    r: decodeSrgbChannel(color.r),
    g: decodeSrgbChannel(color.g),
    b: decodeSrgbChannel(color.b),
  };
};
