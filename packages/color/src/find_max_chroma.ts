import type { MaxChroma } from "./schema";
import { find_gamut_intersection } from "./find_gamut_intersection";
import { clamp } from "@zemd/std-modules/math";

const eps = 0.0001;
export const find_max_chroma = (color: MaxChroma): number => {
  const h_rad = color.h * (Math.PI / 180);

  const direction = {
    a: Math.cos(h_rad),
    b: Math.sin(h_rad),
  };
  // => a^2 + b^2 = 1

  const L0 = clamp(color.L, 0, 1);

  const t = find_gamut_intersection({
    direction,
    line: {
      originLightness: L0,
      targetLightness: L0,
      targetChroma: 1 + eps,
    },
  });

  return Math.max(0, t);
};
