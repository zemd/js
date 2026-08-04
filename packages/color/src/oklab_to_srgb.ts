import type { Oklab, RGB } from "./schema";
import { linear_srgb_to_srgb } from "./linear_srgb_to_srgb";
import { oklab_to_linear_srgb } from "./oklab_to_linear_srgb";

export const oklab_to_srgb = (color: Oklab): RGB => {
  return linear_srgb_to_srgb(oklab_to_linear_srgb(color));
};
