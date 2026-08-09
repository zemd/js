import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
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
  target: false,
});

export default config;
