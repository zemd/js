import type { LinearRGB, Oklab } from "./schema/index.ts";

export const oklab_to_linear_srgb = (color: Oklab): LinearRGB => {
  const l_: number = color.L + 0.396_337_777_4 * color.a + 0.215_803_757_3 * color.b;
  const m_: number = color.L - 0.105_561_345_8 * color.a - 0.063_854_172_8 * color.b;
  const s_: number = color.L - 0.089_484_177_5 * color.a - 1.291_485_548 * color.b;

  const l: number = l_ * l_ * l_;
  const m: number = m_ * m_ * m_;
  const s: number = s_ * s_ * s_;

  return {
    r: +4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  };
};
