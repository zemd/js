import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  // A single entry keeps the output a single file: the shared workflows run it
  // straight from a checkout, without a package manager or node_modules around.
  entry: { gha: "src/cli.ts" },
  format: ["esm"],
  platform: "node",
  dts: false,
  // Readable output keeps the committed diff reviewable and CodeQL useful.
  minify: false,
  target: false,
});

export default config;
