import type { GamutCusp, HueDirection, LinearRGB } from "./schema/index.ts";
import { compute_max_saturation } from "./compute_max_saturation.ts";
import { oklab_to_linear_srgb } from "./oklab_to_linear_srgb.ts";

export const find_cusp = (direction: HueDirection): GamutCusp => {
  const { a, b } = direction;

  // First, find the maximum saturation (saturation S = C/L)
  const S_cusp: number = compute_max_saturation(direction);

  // Convert to linear sRGB to find the first point where at least one of r,g or b >= 1:
  const rgb_at_max: LinearRGB = oklab_to_linear_srgb({
    L: 1,
    a: S_cusp * a,
    b: S_cusp * b,
  });
  const L_cusp: number = Math.cbrt(
    1 / Math.max(Math.max(rgb_at_max.r, rgb_at_max.g), rgb_at_max.b),
  );
  const C_cusp: number = L_cusp * S_cusp;

  return { L: L_cusp, C: C_cusp };
};
