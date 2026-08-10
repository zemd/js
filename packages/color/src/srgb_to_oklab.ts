import type { Oklab, RGB } from "./schema/index.ts";
import { linear_srgb_to_oklab } from "./linear_srgb_to_oklab.ts";
import { srgb_to_linear_srgb } from "./srgb_to_linear_srgb.ts";

export const srgb_to_oklab = (color: RGB): Oklab => {
  return linear_srgb_to_oklab(srgb_to_linear_srgb(color));
};
