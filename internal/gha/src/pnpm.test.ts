import assert from "node:assert/strict";
import { test } from "node:test";

import { parseAppliedReleases, parsePublishSummary, parseWorkspacePackages } from "./pnpm.ts";

void test("parses the applied releases pnpm reports", () => {
  const releases = parseAppliedReleases(
    JSON.stringify([{ name: "example", currentVersion: "1.0.0", newVersion: "1.1.0" }]),
  );

  assert.deepStrictEqual(releases, [
    { name: "example", currentVersion: "1.0.0", newVersion: "1.1.0" },
  ]);
});

void test("names the offending field when pnpm's release shape changes", () => {
  assert.throws(
    () => parseAppliedReleases(JSON.stringify([{ name: "example", currentVersion: 1 }])),
    /pnpm version -r --json\[0\]: expected "currentVersion" to be a string, got 1/,
  );
});

void test("rejects a non-array release payload", () => {
  assert.throws(() => parseAppliedReleases(JSON.stringify({})), /expected an array/);
});

void test("normalises the private flag on workspace packages", () => {
  const workspace = parseWorkspacePackages(
    JSON.stringify([
      { name: "public", version: "1.0.0", path: "/a" },
      { name: "internal", version: "1.0.0", path: "/b", private: true },
    ]),
  );

  assert.deepStrictEqual(workspace, [
    { name: "public", version: "1.0.0", path: "/a", private: false },
    { name: "internal", version: "1.0.0", path: "/b", private: true },
  ]);
});

void test("treats a publish summary without published packages as empty", () => {
  assert.deepStrictEqual(parsePublishSummary(JSON.stringify({})), []);
});

void test("parses the published packages pnpm reports", () => {
  assert.deepStrictEqual(
    parsePublishSummary(JSON.stringify({ publishedPackages: [{ name: "a", version: "1.0.0" }] })),
    [{ name: "a", version: "1.0.0" }],
  );
});
