import { defineConfig, type PlaywrightTestConfig } from "playwright/test";

const config: PlaywrightTestConfig = defineConfig({
  testDir: "./src",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  ...(process.env["CI"] ? { workers: 1 } : {}),
  reporter: "list",
  outputDir: "test-results",
  use: {
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});

export default config;
