import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { renderReleasePrBody } from "./release-pr-body.mjs";

const packageFixture = (t, changelog) => {
  const directory = mkdtempSync(join(tmpdir(), "release-pr-body-"));
  t.after(() => rmSync(directory, { recursive: true }));
  writeFileSync(join(directory, "CHANGELOG.md"), changelog);
  return directory;
};

void test("renders a same-version unpublished package as a first release", (t) => {
  const path = packageFixture(
    t,
    `# @zemd/new-package

## 0.0.0

### Major Changes

- Publish the initial package.
`,
  );

  const body = renderReleasePrBody(
    [{ name: "@zemd/new-package", currentVersion: "0.0.0", newVersion: "0.0.0" }],
    [{ name: "@zemd/new-package", version: "0.0.0", path }],
  );

  assert.match(body, /prepared \*\*1\*\* package for release/);
  assert.ok(body.includes("| `@zemd/new-package` | first release | — | `0.0.0` |"));
  assert.ok(body.includes("**Major Changes**"));
  assert.ok(body.includes("Publish the initial package."));
});

void test("renders an ordinary version bump from pnpm's applied release data", (t) => {
  const path = packageFixture(
    t,
    `# example

## [2.0.0]

### Major Changes

- Break the old API.

## 1.2.3

- Previous release.
`,
  );

  const body = renderReleasePrBody(
    [{ name: "example", currentVersion: "1.2.3", newVersion: "2.0.0" }],
    [{ name: "example", version: "2.0.0", path }],
  );

  assert.ok(body.includes("| `example` | **major** | `1.2.3` | `2.0.0` |"));
  assert.ok(body.includes("1.2.3 &rarr; <b>2.0.0</b>"));
  assert.ok(body.includes("Break the old API."));
  assert.ok(!body.includes("Previous release."));
});
