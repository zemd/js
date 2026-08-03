import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

/**
 * Mirrors the `paths` entry in `tsconfig.json`. `@zemd/properties` is private and never
 * published, so it is aliased rather than declared as a dependency that would leak into
 * the published metadata as an unresolvable name.
 */
const propertiesAlias = {
  "@zemd/properties": fileURLToPath(new URL("../../internal/properties/src", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          include: ["src/dom/**/*.test.ts"],
          name: "browser",
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            headless: true,
            screenshotFailures: false,
            fileParallelism: false,
          },
          environment: "happy-dom",
          maxConcurrency: 1,
        },
      },
      {
        test: {
          include: ["**/*.test.ts"],
          exclude: [
            "src/dom/**",
            "**/node_modules/**",
            "**/dist/**",
            "**/.{idea,git,cache,output,temp}/**",
            "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
          ],
          name: "unit",
          environment: "node",
        },
        resolve: { alias: propertiesAlias },
      },
    ],
  },
});
