import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts", "src/pino-pretty-transport.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
});

export default config;
