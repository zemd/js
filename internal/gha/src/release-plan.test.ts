import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createReleasePlanArtifact,
  parseReleasePlan,
  validateReleasePlanArtifact,
} from "./release-plan.ts";

void test("normalizes a release plan to package identities and versions", (context) => {
  const root = mkdtempSync(join(tmpdir(), "release-plan-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const artifact = join(root, "artifact");
  mkdirSync(artifact);

  const created = createReleasePlanArtifact(
    artifact,
    [
      { name: "@acme/private", path: "/sensitive/private", private: true },
      {
        name: "@acme/public",
        version: "1.2.3",
        path: "/sensitive/public",
        private: false,
      },
    ],
    "4.5.6",
  );

  assert.deepStrictEqual(created, {
    contractVersion: "4.5.6",
    packages: [{ name: "@acme/public", version: "1.2.3" }],
  });
  assert.deepStrictEqual(validateReleasePlanArtifact(artifact), created);
  const source = readFileSync(join(artifact, "release-plan.json"), "utf8");
  assert.doesNotMatch(source, /sensitive|private|path/);
});

void test("rejects caller-controlled fields from a release plan", () => {
  assert.throws(
    () =>
      parseReleasePlan(
        JSON.stringify({
          contractVersion: "1.2.3",
          packages: [
            {
              name: "@acme/public",
              version: "1.2.3",
              path: "scripts/steal-token.js",
            },
          ],
        }),
      ),
    /expected only name, version/,
  );
});

void test("rejects values that could escape fixed release-state request paths", () => {
  assert.throws(
    () =>
      parseReleasePlan(
        JSON.stringify({
          contractVersion: "1.2.3\nmalicious=true",
          packages: [],
        }),
      ),
    /plain semver contract version/,
  );
  assert.throws(
    () =>
      parseReleasePlan(
        JSON.stringify({
          contractVersion: "",
          packages: [{ name: "../../other/repo", version: "1.2.3" }],
        }),
      ),
    /invalid npm package name/,
  );
});

void test("rejects invalid package versions from a release plan artifact", (context) => {
  const root = mkdtempSync(join(tmpdir(), "release-plan-version-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const planPath = join(root, "release-plan.json");

  for (const version of ["1.2.3-", "1.2.3-alpha..1", "01.2.3", "1.2.3-01"]) {
    writeFileSync(
      planPath,
      `${JSON.stringify({
        contractVersion: "",
        packages: [{ name: "@acme/public", version }],
      })}\n`,
    );

    assert.throws(() => validateReleasePlanArtifact(root), {
      message: `release plan.packages[0]: invalid npm package version ${JSON.stringify(version)}`,
    });
  }
});

void test("rejects unexpected files in a release plan artifact", (context) => {
  const root = mkdtempSync(join(tmpdir(), "release-plan-extra-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "release-plan.json"), '{"contractVersion":"","packages":[]}\n');
  writeFileSync(join(root, "postinstall.js"), "throw new Error('must never run')\n");

  assert.throws(() => validateReleasePlanArtifact(root), /must contain only release-plan\.json/);
});
