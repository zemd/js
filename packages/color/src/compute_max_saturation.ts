import type { HueDirection } from "./schema";

// Finds the maximum saturation possible for a given hue that fits in sRGB
// Saturation here is defined as S = C/L
// a and b must be normalized so a^2 + b^2 == 1
export const compute_max_saturation = (direction: HueDirection): number => {
  const { a, b } = direction;

  // Max saturation will be when one of r, g or b goes below zero.

  // Select different coefficients depending on which component goes below zero first
  let k0, k1, k2, k3, k4, wl, wm, ws;

  if (-1.881_703_28 * a - 0.809_364_93 * b > 1) {
    // Red component
    k0 = +1.190_862_77;
    k1 = +1.765_767_28;
    k2 = +0.596_626_41;
    k3 = +0.755_151_97;
    k4 = +0.567_712_45;
    wl = +4.076_741_662_1;
    wm = -3.307_711_591_3;
    ws = +0.230_969_929_2;
  } else if (1.814_441_04 * a - 1.194_452_76 * b > 1) {
    // Green component
    k0 = +0.739_565_15;
    k1 = -0.459_544_04;
    k2 = +0.082_854_27;
    k3 = +0.125_410_7;
    k4 = +0.145_032_04;
    wl = -1.268_438_004_6;
    wm = +2.609_757_401_1;
    ws = -0.341_319_396_5;
  } else {
    // Blue component
    k0 = +1.357_336_52;
    k1 = -0.009_157_99;
    k2 = -1.151_302_1;
    k3 = -0.505_596_06;
    k4 = +0.006_921_67;
    wl = -0.004_196_086_3;
    wm = -0.703_418_614_7;
    ws = +1.707_614_701;
  }

  // Approximate max saturation using a polynomial:
  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

  // Do one step Halley's method to get closer
  // this gives an error less than 10e-6, except for some blue hues where the dS/dh is close to infinite
  // this should be sufficient for most applications, otherwise do two/three steps

  const k_l = +0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const k_m = -0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const k_s = -0.089_484_177_5 * a - 1.291_485_548 * b;

  {
    const l_ = 1 + S * k_l;
    const m_ = 1 + S * k_m;
    const s_ = 1 + S * k_s;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const l_dS = 3 * k_l * l_ * l_;
    const m_dS = 3 * k_m * m_ * m_;
    const s_dS = 3 * k_s * s_ * s_;

    const l_dS2 = 6 * k_l * k_l * l_;
    const m_dS2 = 6 * k_m * k_m * m_;
    const s_dS2 = 6 * k_s * k_s * s_;

    const f = wl * l + wm * m + ws * s;
    const f1 = wl * l_dS + wm * m_dS + ws * s_dS;
    const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

    S = S - (f * f1) / (f1 * f1 - 0.5 * f * f2);
  }

  return S;
};
