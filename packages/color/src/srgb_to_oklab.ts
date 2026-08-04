import type { Oklab, RGB } from "./schema";
import { linear_srgb_to_oklab } from "./linear_srgb_to_oklab";
import { srgb_to_linear_srgb } from "./srgb_to_linear_srgb";

export const srgb_to_oklab = (color: RGB): Oklab => {
  return linear_srgb_to_oklab(srgb_to_linear_srgb(color));
};
