import { linear_srgb_to_srgb } from "./linear_srgb_to_srgb";
import { oklab_to_linear_srgb } from "./oklab_to_linear_srgb";
import type { Lch, RGB } from "./schema";

export const oklch_to_srgb = (color: Lch): RGB => {
  const h_rad = color.h * (Math.PI / 180);

  const a = color.c * Math.cos(h_rad);
  const b = color.c * Math.sin(h_rad);
  // => a^2 + b^2 = c^2

  const linearColor = oklab_to_linear_srgb({ L: color.L, a, b });

  return linear_srgb_to_srgb(linearColor);
};
