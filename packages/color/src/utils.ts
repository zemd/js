import { clamp } from "@zemd/std-modules/math";

export const decodeSrgbChannel = (channel: number): number => {
  const value = channel / 255;

  if (value <= 0.040_45) {
    return value / 12.92;
  }

  return Math.pow((value + 0.055) / 1.055, 2.4);
};

export const encodeLinearSrgbChannel = (channel: number): number => {
  if (channel <= 0.003_130_8) {
    return 12.92 * channel;
  }

  return 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
};

export const encodeLinearSrgbChannelTo8Bit = (channel: number): number => {
  return Math.round(clamp(encodeLinearSrgbChannel(channel), 0, 1) * 255);
};
