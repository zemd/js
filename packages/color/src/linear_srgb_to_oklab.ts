import type { LinearRGB, Oklab } from "./schema/index.ts";

export const linear_srgb_to_oklab = (color: LinearRGB): Oklab => {
  const l: number =
    0.412_221_470_8 * color.r + 0.536_332_536_3 * color.g + 0.051_445_992_9 * color.b;
  const m: number =
    0.211_903_498_2 * color.r + 0.680_699_545_1 * color.g + 0.107_396_956_6 * color.b;
  const s: number =
    0.088_302_461_9 * color.r + 0.281_718_837_6 * color.g + 0.629_978_700_5 * color.b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.210_454_255_3 * l_ + 0.793_617_785 * m_ - 0.004_072_046_8 * s_,
    a: 1.977_998_495_1 * l_ - 2.428_592_205 * m_ + 0.450_593_709_9 * s_,
    b: 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766 * s_,
  };
};
