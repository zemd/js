import { defineConfig } from "tsdown";

// Fuzz targets are emitted as self-contained CommonJS bundles so that Jazzer.js can
// load them on any Node version and instrument the library code (bundled, therefore
// outside `node_modules`) for coverage feedback.
export default defineConfig({
  entry: ["src/fuzz_*.ts"],
  format: ["cjs"],
  outExtensions: () => {
    return { js: ".js" };
  },
  platform: "node",
  dts: false,
  minify: false,
  sourcemap: false,
  splitting: false,
  target: false,
  deps: {
    alwaysBundle: [/^@zemd\//],
    neverBundle: [/^@jazzer\.js\//],
  },
});
