import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

import { contractVersion } from "./contract-version";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("prepares a private contract bump and corrects pnpm's release report", async () => {
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

  expect(JSON.parse(readFileSync(manifest, "utf8"))).toMatchObject({ version: "1.0.1" });
  expect(JSON.parse(readFileSync(state, "utf8"))).toEqual({
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

  expect(JSON.parse(readFileSync(releases, "utf8"))).toEqual([
    { name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.0.1" },
  ]);
});

test("writes a no-op state when no intent targets the configured package", async () => {
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

  expect(readFileSync(manifest, "utf8")).toBe(source);
  expect(readFileSync(state, "utf8")).toBe("null\n");
});
