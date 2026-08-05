import { expect, test } from "vitest";

import { parseAppliedReleases, parsePublishSummary, parseWorkspacePackages } from "./pnpm";

test("parses the applied releases pnpm reports", () => {
  const releases = parseAppliedReleases(
    JSON.stringify([{ name: "example", currentVersion: "1.0.0", newVersion: "1.1.0" }]),
  );

  expect(releases).toEqual([{ name: "example", currentVersion: "1.0.0", newVersion: "1.1.0" }]);
});

test("names the offending field when pnpm's release shape changes", () => {
  expect(() =>
    parseAppliedReleases(JSON.stringify([{ name: "example", currentVersion: 1 }])),
  ).toThrow(/pnpm version -r --json\[0\]: expected "currentVersion" to be a string, got 1/);
});

test("rejects a non-array release payload", () => {
  expect(() => parseAppliedReleases(JSON.stringify({}))).toThrow(/expected an array/);
});

test("normalises the private flag on workspace packages", () => {
  const workspace = parseWorkspacePackages(
    JSON.stringify([
      { name: "public", version: "1.0.0", path: "/a" },
      { name: "internal", version: "1.0.0", path: "/b", private: true },
    ]),
  );

  expect(workspace).toEqual([
    { name: "public", version: "1.0.0", path: "/a", private: false },
    { name: "internal", version: "1.0.0", path: "/b", private: true },
  ]);
});

test("treats a publish summary without published packages as empty", () => {
  expect(parsePublishSummary(JSON.stringify({}))).toEqual([]);
});

test("parses the published packages pnpm reports", () => {
  expect(
    parsePublishSummary(JSON.stringify({ publishedPackages: [{ name: "a", version: "1.0.0" }] })),
  ).toEqual([{ name: "a", version: "1.0.0" }]);
});
