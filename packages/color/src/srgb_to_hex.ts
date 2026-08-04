import type { RGB } from "./schema";

export const srgb_to_hex = (color: RGB): string => {
  return (color.b | (color.g << 8) | (color.r << 16) | (1 << 24)).toString(16).slice(1);
};
