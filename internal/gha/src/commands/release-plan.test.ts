import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import { releasePlan } from "./release-plan.ts";

void test("creates and validates the data-only release plan artifact", async (context) => {
  const root = mkdtempSync(join(tmpdir(), "release-plan-command-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const workspacePath = join(root, "pnpm-workspace.json");
  const contractPath = join(root, "contract-package.json");
  const artifact = join(root, "artifact");
  const outputPath = join(root, "workspace.json");
  mkdirSync(artifact);
  writeFileSync(
    workspacePath,
    JSON.stringify([
      { name: "@acme/public", version: "1.2.3", path: "/caller/package", private: false },
      { name: "@acme/private", path: "/caller/private", private: true },
    ]),
  );
  writeFileSync(contractPath, '{"name":"@acme/contract","version":"4.5.6","private":true}\n');

  await releasePlan.run(["create", workspacePath, artifact, contractPath]);

  let output = "";
  context.mock.method(process.stdout, "write", (chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  });
  await releasePlan.run(["validate", artifact, outputPath]);

  assert.strictEqual(output, "contract_version=4.5.6\n");
  assert.deepStrictEqual(JSON.parse(readFileSync(outputPath, "utf8")) as unknown, [
    { name: "@acme/public", version: "1.2.3", path: ".", private: false },
  ]);
});
