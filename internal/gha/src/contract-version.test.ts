import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bumpContractVersion,
  planContractVersion,
  reconcileContractRelease,
} from "./contract-version.ts";

void test("applies each supported contract bump", () => {
  for (const [version, bump, expected] of [
    ["1.2.3", "patch", "1.2.4"],
    ["1.2.3", "minor", "1.3.0"],
    ["1.2.3", "major", "2.0.0"],
  ] as const) {
    assert.strictEqual(
      bumpContractVersion(version, bump),
      expected,
      `expected the ${bump} bump for ${version}`,
    );
  }
});

void test("plans the highest bump across matching change intents", () => {
  const plan = planContractVersion({ name: "@zemd/gha", version: "1.0.0" }, [
    { id: "patch-one", source: '---\n"@zemd/gha": patch\n---\n\nPatch.\n' },
    { id: "unrelated", source: "---\nother: major\n---\n\nOther.\n" },
    { id: "minor-one", source: "---\n'@zemd/gha': 'minor'\n---\n\nMinor.\n" },
  ]);

  assert.deepStrictEqual(plan, {
    name: "@zemd/gha",
    currentVersion: "1.0.0",
    newVersion: "1.1.0",
    bump: "minor",
    intentIds: ["minor-one", "patch-one"],
  });
});

void test("does not plan a bump without a matching release intent", () => {
  assert.strictEqual(
    planContractVersion({ name: "@zemd/gha", version: "1.0.0" }, [
      { id: "unrelated", source: "---\nother: patch\n---\n" },
    ]),
    undefined,
  );
});

void test("restores the real old version in pnpm's same-version result", () => {
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

  assert.deepStrictEqual(releases, [
    { name: "public-package", currentVersion: "2.0.0", newVersion: "2.0.1" },
    { name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.0.1" },
  ]);
});

void test("accepts pnpm reporting the intended transition itself", () => {
  const releases = [{ name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.0.1" }];
  assert.strictEqual(
    reconcileContractRelease(releases, {
      name: "@zemd/gha",
      currentVersion: "1.0.0",
      newVersion: "1.0.1",
      bump: "patch",
      intentIds: ["fix"],
    }),
    releases,
  );
});

void test("rejects an unexpected pnpm transition", () => {
  assert.throws(
    () =>
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
    /unexpected @zemd\/gha transition/,
  );
});
