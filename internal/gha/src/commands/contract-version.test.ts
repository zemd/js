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

void test("prepares a private contract bump and corrects pnpm's release report", async () => {
  const directory = mkdtempSync(join(tmpdir(), "contract-version-"));
  directories.push(directory);
  const intents = join(directory, ".changeset");
  const manifest = join(directory, "package.json");
  const state = join(directory, "contract-version.json");
  const releases = join(directory, "releases.json");
  mkdirSync(intents);
  writeFileSync(
    manifest,
    '{\n  "name": "@zemd/gha",\n  "version": "1.0.0",\n  "private": true\n}\n',
  );
  writeFileSync(
    join(intents, "fix.md"),
    '---\n"@zemd/gha": patch\n---\n\nFix the release contract.\n',
  );

  await contractVersion.run(["prepare", manifest, intents, state]);

  assert.partialDeepStrictEqual(JSON.parse(readFileSync(manifest, "utf8")), { version: "1.0.1" });
  assert.deepStrictEqual(JSON.parse(readFileSync(state, "utf8")), {
    name: "@zemd/gha",
    currentVersion: "1.0.0",
    newVersion: "1.0.1",
    bump: "patch",
    intentIds: ["fix"],
  });

  writeFileSync(
    releases,
    JSON.stringify([{ name: "@zemd/gha", currentVersion: "1.0.1", newVersion: "1.0.1" }]),
  );
  await contractVersion.run(["finalize", state, releases]);

  assert.deepStrictEqual(JSON.parse(readFileSync(releases, "utf8")), [
    { name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.0.1" },
  ]);
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
