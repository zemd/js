import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    /**
     * Mirrors the `paths` entry in `tsconfig.json`. `@zemd/properties` is private and never
     * published, so it is aliased rather than declared as a dependency that would leak into
     * the published metadata as an unresolvable name.
     */
    alias: {
      "@zemd/properties": fileURLToPath(new URL("../../internal/properties/src", import.meta.url)),
    },
  },
});
