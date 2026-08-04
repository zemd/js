import * as z from "zod";

export const RGBSchema = z.object({
  r: z.number().int().min(0).max(255), // Red channel, 0-255.
  g: z.number().int().min(0).max(255), // Green channel, 0-255.
  b: z.number().int().min(0).max(255), // Blue channel, 0-255.
});
export type RGB = z.infer<typeof RGBSchema>;

export const LinearRGBSchema = z.object({
  r: z.number(), // Linear red channel; usually 0-1, may exceed for out-of-gamut values.
  g: z.number(), // Linear green channel; usually 0-1, may exceed for out-of-gamut values.
  b: z.number(), // Linear blue channel; usually 0-1, may exceed for out-of-gamut values.
});
export type LinearRGB = z.infer<typeof LinearRGBSchema>;

export const OklabSchema = z.object({
  L: z.number(), // Perceptual lightness; usually 0-1.
  a: z.number(), // Green-red opponent axis; any number, in-gamut values are near -0.5 to 0.5.
  b: z.number(), // Blue-yellow opponent axis; any number, in-gamut values are near -0.5 to 0.5.
});
export type Oklab = z.infer<typeof OklabSchema>;

export const LabSchema = z.object({
  L: z.number().min(0).max(100), // CIELAB lightness, 0-100.
  a: z.number().min(-128).max(127), // Green-red opponent axis, -128 to 127.
  b: z.number().min(-128).max(127), // Blue-yellow opponent axis, -128 to 127.
});
export type Lab = z.infer<typeof LabSchema>;

export const LchSchema = z.object({
  L: z.number().min(0).max(1), // OKLCH lightness, 0-1.
  c: z.number().min(0), // OKLCH chroma, 0 or higher; sRGB is roughly 0-0.4.
  h: z.number().min(0).max(360), // Hue angle in degrees, 0-360.
});
export type Lch = z.infer<typeof LchSchema>;

export const HueDirectionSchema = z.object({
  a: z.number().min(-1).max(1), // Normalized OKLab a direction, -1 to 1.
  b: z.number().min(-1).max(1), // Normalized OKLab b direction, -1 to 1.
});
export type HueDirection = z.infer<typeof HueDirectionSchema>;

export const GamutLineSchema = z.object({
  originLightness: z.number(), // Start lightness for the gamut line; usually 0-1.
  targetLightness: z.number(), // Target lightness for the gamut line; usually 0-1.
  targetChroma: z.number(), // Target chroma for the gamut line, 0 or higher.
});
export type GamutLine = z.infer<typeof GamutLineSchema>;

export const MaxChromaSchema = z.object({
  L: z.number(), // OKLCH lightness to test; usually 0-1.
  h: z.number().min(0).max(360), // Hue angle in degrees, 0-360.
});
export type MaxChroma = z.infer<typeof MaxChromaSchema>;

export const GamutCuspSchema = z.object({
  L: z.number(), // Cusp lightness in the sRGB gamut, 0-1.
  C: z.number(), // Cusp chroma in the sRGB gamut, 0 or higher.
});
export type GamutCusp = z.infer<typeof GamutCuspSchema>;
