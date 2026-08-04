import type { GamutCusp, GamutLine, HueDirection } from "./schema";
import { find_cusp } from "./find_cusp";

export type GamutIntersectionInput = {
  direction: HueDirection;
  line: GamutLine;
};

// Finds intersection of the line defined by
// L = L0 * (1 - t) + t * L1;
// C = t * C1;
// a and b must be normalized so a^2 + b^2 == 1
export const find_gamut_intersection = ({ direction, line }: GamutIntersectionInput): number => {
  const { a, b } = direction;
  const L0 = line.originLightness;
  const L1 = line.targetLightness;
  const C1 = line.targetChroma;

  // Find the cusp of the gamut triangle
  const cusp: GamutCusp = find_cusp(direction);

  // Find the intersection for upper and lower half separately
  let t: number;
  if ((L1 - L0) * cusp.C - (cusp.L - L0) * C1 <= 0) {
    // Lower half

    t = (cusp.C * L0) / (C1 * cusp.L + cusp.C * (L0 - L1));
  } else {
    // Upper half

    // First intersect with triangle
    t = (cusp.C * (L0 - 1)) / (C1 * (cusp.L - 1) + cusp.C * (L0 - L1));

    // Then one step Halley's method
    {
      const dL: number = L1 - L0;
      const dC: number = C1;

      const k_l: number = +0.396_337_777_4 * a + 0.215_803_757_3 * b;
      const k_m: number = -0.105_561_345_8 * a - 0.063_854_172_8 * b;
      const k_s: number = -0.089_484_177_5 * a - 1.291_485_548 * b;

      const l_dt: number = dL + dC * k_l;
      const m_dt: number = dL + dC * k_m;
      const s_dt: number = dL + dC * k_s;

      // If higher accuracy is required, 2 or 3 iterations of the following block can be used:
      {
        const L: number = L0 * (1 - t) + t * L1;
        const C: number = t * C1;

        const l_: number = L + C * k_l;
        const m_: number = L + C * k_m;
        const s_: number = L + C * k_s;

        const l: number = l_ * l_ * l_;
        const m: number = m_ * m_ * m_;
        const s: number = s_ * s_ * s_;

        const ldt: number = 3 * l_dt * l_ * l_;
        const mdt: number = 3 * m_dt * m_ * m_;
        const sdt: number = 3 * s_dt * s_ * s_;

        const ldt2: number = 6 * l_dt * l_dt * l_;
        const mdt2: number = 6 * m_dt * m_dt * m_;
        const sdt2: number = 6 * s_dt * s_dt * s_;

        const r: number = 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s - 1;
        const r1: number = 4.076_741_662_1 * ldt - 3.307_711_591_3 * mdt + 0.230_969_929_2 * sdt;
        const r2: number = 4.076_741_662_1 * ldt2 - 3.307_711_591_3 * mdt2 + 0.230_969_929_2 * sdt2;

        const u_r: number = r1 / (r1 * r1 - 0.5 * r * r2);
        let t_r: number = -r * u_r;

        const g: number = -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s - 1;
        const g1: number = -1.268_438_004_6 * ldt + 2.609_757_401_1 * mdt - 0.341_319_396_5 * sdt;
        const g2: number =
          -1.268_438_004_6 * ldt2 + 2.609_757_401_1 * mdt2 - 0.341_319_396_5 * sdt2;

        const u_g: number = g1 / (g1 * g1 - 0.5 * g * g2);
        let t_g: number = -g * u_g;

        const b: number = -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s - 1;
        const b1: number = -0.004_196_086_3 * ldt - 0.703_418_614_7 * mdt + 1.707_614_701 * sdt;
        const b2: number = -0.004_196_086_3 * ldt2 - 0.703_418_614_7 * mdt2 + 1.707_614_701 * sdt2;

        const u_b: number = b1 / (b1 * b1 - 0.5 * b * b2);
        let t_b: number = -b * u_b;

        t_r = u_r >= 0 ? t_r : Number.MAX_VALUE; // FLT_MAX;
        t_g = u_g >= 0 ? t_g : Number.MAX_VALUE; // FLT_MAX;
        t_b = u_b >= 0 ? t_b : Number.MAX_VALUE; // FLT_MAX;

        t += Math.min(t_r, Math.min(t_g, t_b));
      }
    }
  }

  return t;
};
