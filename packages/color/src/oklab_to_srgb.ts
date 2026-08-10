import type { Oklab, RGB } from "./schema/index.ts";
import { linear_srgb_to_srgb } from "./linear_srgb_to_srgb.ts";
import { oklab_to_linear_srgb } from "./oklab_to_linear_srgb.ts";

export const oklab_to_srgb = (color: Oklab): RGB => {
  return linear_srgb_to_srgb(oklab_to_linear_srgb(color));
};
