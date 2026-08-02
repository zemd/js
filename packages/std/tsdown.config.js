import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/dom.ts",
    "src/env.ts",
    "src/errors.ts",
    "src/invariant.ts",
    "src/math.ts",
    "src/objects.ts",
    "src/types.ts",
    "src/promises.ts",
  ],
  format: ["esm"],
  dts: true,
  minify: true,
  splitting: false,
  target: false,
});
