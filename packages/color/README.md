# @zemd/color

[![npm](https://img.shields.io/npm/v/@zemd/color?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/color)

Typed, tree-shakeable color utilities for converting between sRGB, linear sRGB, OKLab, and OKLCH, finding sRGB gamut boundaries, and validating color data with Zod.

## Installation

```sh
npm install @zemd/color
```

```sh
pnpm add @zemd/color
```

## Usage

```ts
import {
  RGBSchema,
  find_max_chroma,
  oklch_to_srgb,
  srgb_to_hex,
  srgb_to_oklch,
  type RGB,
} from "@zemd/color";

const color: RGB = RGBSchema.parse({ r: 64, g: 128, b: 192 });
const oklch = srgb_to_oklch(color);
const roundTripped = oklch_to_srgb(oklch);

srgb_to_hex(roundTripped); // "4080c0"
find_max_chroma({ L: oklch.L, h: oklch.h });
```

Hexadecimal values are returned without a leading `#`.

## API

### Conversion utilities

| Utility                         | Conversion                                         |
| ------------------------------- | -------------------------------------------------- |
| `srgb_to_linear_srgb`           | 8-bit sRGB to linear sRGB                          |
| `linear_srgb_to_srgb`           | Linear sRGB to 8-bit sRGB                          |
| `linear_srgb_to_oklab`          | Linear sRGB to OKLab                               |
| `oklab_to_linear_srgb`          | OKLab to linear sRGB                               |
| `srgb_to_oklab`                 | 8-bit sRGB to OKLab                                |
| `oklab_to_srgb`                 | OKLab to clipped 8-bit sRGB                        |
| `srgb_to_oklch`                 | 8-bit sRGB to OKLCH                                |
| `oklch_to_srgb`                 | OKLCH to clipped 8-bit sRGB                        |
| `srgb_to_hex`                   | 8-bit sRGB to hexadecimal                          |
| `decodeSrgbChannel`             | One 8-bit sRGB channel to linear sRGB              |
| `encodeLinearSrgbChannel`       | One linear sRGB channel to encoded sRGB            |
| `encodeLinearSrgbChannelTo8Bit` | One linear sRGB channel to a clipped 8-bit channel |

### Gamut utilities

- `find_max_chroma` finds the approximate maximum sRGB chroma for an OKLCH lightness and hue.
- `compute_max_saturation`, `find_cusp`, and `find_gamut_intersection` expose the lower-level OKLab gamut calculations. Their hue direction inputs must be normalized so that `a² + b² = 1`.

### Schemas and types

Every schema has a corresponding inferred TypeScript type:

| Schema               | Type           | Value model                              |
| -------------------- | -------------- | ---------------------------------------- |
| `RGBSchema`          | `RGB`          | Integer sRGB channels from 0 through 255 |
| `LinearRGBSchema`    | `LinearRGB`    | Linear sRGB channels                     |
| `OklabSchema`        | `Oklab`        | OKLab lightness and opponent axes        |
| `LchSchema`          | `Lch`          | OKLCH lightness, chroma, and hue         |
| `LabSchema`          | `Lab`          | CIELAB coordinates                       |
| `HueDirectionSchema` | `HueDirection` | Normalized OKLab hue direction           |
| `GamutLineSchema`    | `GamutLine`    | Line used for gamut intersection         |
| `GamutCuspSchema`    | `GamutCusp`    | sRGB gamut cusp                          |
| `MaxChromaSchema`    | `MaxChroma`    | Input for `find_max_chroma`              |

sRGB channel values use the integer range 0-255. OKLab and OKLCH lightness use 0-1, and hue is expressed in degrees from 0 through 360. Conversion functions operate on typed data and do not perform schema validation automatically; parse untrusted input with the matching schema first.

## References

The OKLab conversion and gamut calculations follow Björn Ottosson's [OKLab color space](https://bottosson.github.io/posts/oklab/) and [sRGB gamut clipping](https://bottosson.github.io/posts/gamutclipping/) references.

## License

`@zemd/color` is released under the Apache 2.0 license.
