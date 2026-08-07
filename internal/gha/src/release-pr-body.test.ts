import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

import type { WorkspacePackage } from "./pnpm";
import { renderReleasePrBody } from "./release-pr-body";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const packageFixture = (changelog: string): string => {
  const directory = mkdtempSync(join(tmpdir(), "release-pr-body-"));
  directories.push(directory);
  writeFileSync(join(directory, "CHANGELOG.md"), changelog);
  return directory;
};

const workspaceEntry = (
  name: string,
  version: string,
  path: string,
  isPrivate = false,
): WorkspacePackage => ({ name, version, path, private: isPrivate });

test("renders a same-version unpublished package as a first release", () => {
  const path = packageFixture(`# @zemd/new-package

## 0.0.0

### Major Changes

- Publish the initial package.
`);

  const body = renderReleasePrBody(
    [{ name: "@zemd/new-package", currentVersion: "0.0.0", newVersion: "0.0.0" }],
    [workspaceEntry("@zemd/new-package", "0.0.0", path)],
  );

  expect(body).toMatch(/prepared \*\*1\*\* package for release/);
  expect(body).toContain("| `@zemd/new-package` | first release | — | `0.0.0` |");
  expect(body).toContain("**Major Changes**");
  expect(body).toContain("Publish the initial package.");
});

test("renders an ordinary version bump from a dated Keep a Changelog entry", () => {
  const path = packageFixture(`# example

## [2.0.0] - 2026-01-01

### Major Changes

- Break the old API.

## 1.2.3

- Previous release.
`);

  const body = renderReleasePrBody(
    [{ name: "example", currentVersion: "1.2.3", newVersion: "2.0.0" }],
    [workspaceEntry("example", "2.0.0", path)],
  );

  expect(body).toContain("| `example` | **major** | `1.2.3` | `2.0.0` |");
  expect(body).toContain("1.2.3 &rarr; <b>2.0.0</b>");
  expect(body).toContain("Break the old API.");
  expect(body).not.toContain("Previous release.");
});

test("lists private packages separately from the published ones", () => {
  const publicPath = packageFixture("# example\n\n## 1.1.0\n\n- Public change.\n");
  const internalPath = packageFixture("# @zemd/gha\n\n## 1.1.0\n\n- Workflow change.\n");

  const body = renderReleasePrBody(
    [
      { name: "example", currentVersion: "1.0.0", newVersion: "1.1.0" },
      { name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.1.0" },
    ],
    [
      workspaceEntry("example", "1.1.0", publicPath),
      workspaceEntry("@zemd/gha", "1.1.0", internalPath, true),
    ],
  );

  expect(body).toMatch(/prepared \*\*1\*\* package for release/);
  expect(body).toContain("### Internal packages");
  expect(body).toContain("Not published to npm.");
  expect(body).toContain("| `@zemd/gha` | **minor** | `1.0.0` | `1.1.0` |");
  expect(body).toContain("Workflow change.");
  expect(body.indexOf("### Changelogs")).toBeLessThan(body.indexOf("### Internal packages"));
});

test("reports when only private packages were prepared", () => {
  const path = packageFixture("# @zemd/gha\n\n## 1.1.0\n\n- Workflow change.\n");

  const body = renderReleasePrBody(
    [{ name: "@zemd/gha", currentVersion: "1.0.0", newVersion: "1.1.0" }],
    [workspaceEntry("@zemd/gha", "1.1.0", path, true)],
  );

  expect(body).toContain("No publishable packages were prepared for release.");
  expect(body).toContain("### Internal packages");
});

test("refuses to render a release for a package outside the workspace snapshot", () => {
  expect(() =>
    renderReleasePrBody([{ name: "ghost", currentVersion: "1.0.0", newVersion: "1.0.1" }], []),
  ).toThrow(/ghost is missing from the workspace snapshot/);
});
