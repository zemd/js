import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { benchmark, formatBenchmarkResult, toBencherMetricFormat } from "@zemd/testing";

import { oklch_to_srgb, srgb_to_oklch, type Lch, type RGB } from "@zemd/color";

const RGB_INPUTS: readonly RGB[] = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 64, g: 128, b: 192 },
  { r: 214, g: 117, b: 31 },
  { r: 17, g: 43, b: 89 },
];
const OKLCH_INPUTS: readonly Lch[] = RGB_INPUTS.map(srgb_to_oklch);

let rgbIndex = 0;
let oklchIndex = 0;
let checksum = 0;

const results = [
  benchmark(
    "srgb_to_oklch",
    () => {
      const color = srgb_to_oklch(RGB_INPUTS[rgbIndex++ % RGB_INPUTS.length]!);
      checksum += color.L + color.c + color.h;
    },
    {
      iterations: 100_000,
      // Informational target: 1,000 conversions within 1 ms.
      budgetNanoseconds: 1_000,
    },
  ),
  benchmark(
    "oklch_to_srgb",
    () => {
      const color = oklch_to_srgb(OKLCH_INPUTS[oklchIndex++ % OKLCH_INPUTS.length]!);
      checksum += color.r + color.g + color.b;
    },
    {
      iterations: 100_000,
      // Informational target: 1,000 conversions within 1 ms.
      budgetNanoseconds: 1_000,
    },
  ),
];

// Keep benchmark results observable so the runtime cannot discard the conversion work.
if (!Number.isFinite(checksum)) {
  throw new Error("color benchmark produced a non-finite checksum");
}

const outputDirectory = process.env["BENCHER_OUTPUT_DIR"];
if (outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    join(outputDirectory, "zemd-color.json"),
    `${JSON.stringify(toBencherMetricFormat(results, { namespace: "@zemd/color" }))}\n`,
    "utf8",
  );
} else {
  console.table(results.map(formatBenchmarkResult));
}
