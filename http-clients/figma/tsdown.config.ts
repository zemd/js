import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
  // Re-exported verbatim via the "./openapi.json" entry of this package.
  copy: ["src/openapi.json"],
  deps: {
    neverBundle: ["@figma/rest-api-spec"],
  },
});

export default config;
