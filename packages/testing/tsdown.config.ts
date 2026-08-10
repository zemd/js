import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  dts: true,
  minify: true,
  target: "node24",
});

export default config;
