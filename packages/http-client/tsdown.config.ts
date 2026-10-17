/**
 * Build configuration for the HTTP client ESM bundle and type declarations.
 *
 * @module tsdown.config
 */

import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
});

export default config;
