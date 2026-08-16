import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

void describe("package contract", () => {
  void it("keeps the optional pretty transport out of the main entry", async () => {
    const mainEntry = await readFile(new URL("../dist/index.mjs", import.meta.url), "utf8");
    const mainExports = await import("@zemd/nestjs-pino-logger");

    assert.doesNotMatch(mainEntry, /clean-stack|pino-pretty/u);
    assert.strictEqual("PinoPrettyTransport" in mainExports, false);
    assert.strictEqual(typeof mainExports["formatLogMessage"], "function");
  });

  void it("declares explicit runtime support and an optional pretty peer", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>;

    assert.deepStrictEqual(packageJson["engines"], { node: ">=20" });
    assert.deepStrictEqual(packageJson["peerDependencies"], {
      "@nestjs/common": "^11.0.0",
      pino: "^10.0.0",
      "pino-pretty": "^13.0.0",
    });
    assert.deepStrictEqual(packageJson["peerDependenciesMeta"], {
      "pino-pretty": { optional: true },
    });
  });
});
