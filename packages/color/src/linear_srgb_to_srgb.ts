import type { LinearRGB, RGB } from "./schema";
import { encodeLinearSrgbChannelTo8Bit } from "./utils";

export const linear_srgb_to_srgb = (color: LinearRGB): RGB => {
  return {
    r: encodeLinearSrgbChannelTo8Bit(color.r),
    g: encodeLinearSrgbChannelTo8Bit(color.g),
    b: encodeLinearSrgbChannelTo8Bit(color.b),
  };
};
