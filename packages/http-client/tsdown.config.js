import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  // The declaration build runs a full TypeScript program, so the tests are excluded to keep
  // it from emitting declarations for the aliased `@zemd/properties` sources.
  tsconfig: "tsconfig.build.json",
  dts: true,
  minify: true,
});
