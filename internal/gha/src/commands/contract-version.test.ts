import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { contractVersion } from "./contract-version.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test("plans a private contract bump without applying it before pnpm", async () => {
  const directory = mkdtempSync(join(tmpdir(), "contract-version-"));
  directories.push(directory);
  const intents = join(directory, ".changeset");
  const manifest = join(directory, "package.json");
  const state = join(directory, "contract-version.json");
  const releases = join(directory, "releases.json");
  mkdirSync(intents);
  const source = '{\n  "name": "@zemd/gha",\n  "version": "4.0.5",\n  "private": true\n}\n';
  writeFileSync(manifest, source);
  writeFileSync(
    join(intents, "fix.md"),
    '---\n"@zemd/gha": patch\n---\n\nFix the release contract.\n',
  );

  await contractVersion.run(["prepare", manifest, intents, state]);

  assert.strictEqual(readFileSync(manifest, "utf8"), source);
  assert.deepStrictEqual(JSON.parse(readFileSync(state, "utf8")), {
    name: "@zemd/gha",
    currentVersion: "4.0.5",
    newVersion: "4.0.6",
    bump: "patch",
    intentIds: ["fix"],
  });

  const report = JSON.stringify([
    { name: "@zemd/gha", currentVersion: "4.0.5", newVersion: "4.0.6" },
  ]);
  writeFileSync(releases, report);
  await contractVersion.run(["finalize", state, releases]);

  assert.deepStrictEqual(JSON.parse(readFileSync(releases, "utf8")), JSON.parse(report));
});

void test("writes a no-op state when no intent targets the configured package", async () => {
  const directory = mkdtempSync(join(tmpdir(), "contract-version-"));
  directories.push(directory);
  const intents = join(directory, ".changeset");
  const manifest = join(directory, "package.json");
  const state = join(directory, "contract-version.json");
  mkdirSync(intents);
  const source = '{\n  "name": "@zemd/gha",\n  "version": "1.0.0",\n  "private": true\n}\n';
  writeFileSync(manifest, source);
  writeFileSync(join(intents, "other.md"), "---\nother: patch\n---\n");

  await contractVersion.run(["prepare", manifest, intents, state]);

  assert.strictEqual(readFileSync(manifest, "utf8"), source);
  assert.strictEqual(readFileSync(state, "utf8"), "null\n");
});
