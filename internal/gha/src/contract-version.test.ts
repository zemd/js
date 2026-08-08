import { expect, test } from "vitest";

import {
  bumpContractVersion,
  planContractVersion,
  reconcileContractRelease,
} from "./contract-version";

test.each([
  ["1.2.3", "patch", "1.2.4"],
  ["1.2.3", "minor", "1.3.0"],
  ["1.2.3", "major", "2.0.0"],
] as const)("applies a %s contract bump", (version, bump, expected) => {
  expect(bumpContractVersion(version, bump)).toBe(expected);
});

test("plans the highest bump across matching change intents", () => {
  const plan = planContractVersion({ name: "@zemd/gha", version: "1.0.0" }, [
    { id: "patch-one", source: '---\n"@zemd/gha": patch\n---\n\nPatch.\n' },
    { id: "unrelated", source: "---\nother: major\n---\n\nOther.\n" },
    { id: "minor-one", source: "---\n'@zemd/gha': 'minor'\n---\n\nMinor.\n" },
  ]);

  expect(plan).toEqual({
    name: "@zemd/gha",
    currentVersion: "1.0.0",
    newVersion: "1.1.0",
    bump: "minor",
    intentIds: ["minor-one", "patch-one"],
  });
});

test("does not plan a bump without a matching release intent", () => {
  expect(
    planContractVersion({ name: "@zemd/gha", version: "1.0.0" }, [
      { id: "unrelated", source: "---\nother: patch\n---\n" },
    ]),
  ).toBeUndefined();
});

test("restores the real old version in pnpm's same-version result", () => {
  const releases = reconcileContractRelease(
    [
      { name: "public-package", currentVersion: "2.0.0", newVersion: "2.0.1" },
      { name: "@zemd/gha", currentVersion: "1.0.1", newVersion: "1.0.1" },
    ],
    {
      name: "@zemd/gha",
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      bump: "patch",
      intentIds: ["fix"],
    },
  );

  expect(releases).toEqual([
    { name: "public-package", currentVersion: "2.0.0", newVersion: "2.0.1" },
    { name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.0.1" },
  ]);
});

test("accepts pnpm reporting the intended transition itself", () => {
  const releases = [{ name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.0.1" }];
  expect(
    reconcileContractRelease(releases, {
      name: "@zemd/gha",
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      bump: "patch",
      intentIds: ["fix"],
    }),
  ).toBe(releases);
});

test("rejects an unexpected pnpm transition", () => {
  expect(() =>
    reconcileContractRelease(
      [{ name: "@zemd/gha", currentVersion: "1.0.1", newVersion: "1.0.2" }],
      {
        name: "@zemd/gha",
        currentVersion: "1.0.0",
        newVersion: "1.0.1",
        bump: "patch",
        intentIds: ["fix"],
      },
    ),
  ).toThrow(/unexpected @zemd\/gha transition/);
});
