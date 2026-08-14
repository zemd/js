import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import {
  createPackageArtifact,
  publishSummary,
  tarballForPackage,
  validatePackageArtifact,
  workspaceFromPackageArtifact,
} from "./package-artifact.ts";

const fixture = <T>(
  run: (paths: { artifact: string; root: string; workspace: string }) => T,
): T => {
  const root = mkdtempSync(join(tmpdir(), "gha-package-artifact-"));
  const workspace = join(root, "packages", "example");
  const artifact = join(root, "artifact");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(artifact);
  writeFileSync(join(workspace, "package.json"), '{"name":"@acme/example","version":"1.2.3"}\n');
  writeFileSync(join(workspace, "CHANGELOG.md"), "# Changelog\n\n## 1.2.3\n\n- Fixed it\n");
  try {
    return run({ artifact, root, workspace });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

void test("creates and independently validates a package artifact", () => {
  fixture(({ artifact, root, workspace }) => {
    const manifest = createPackageArtifact({
      directory: artifact,
      pack: (_packagePath, outputPath) => writeFileSync(outputPath, "tarball bytes"),
      root,
      workspace: [
        { name: "@acme/example", path: workspace, private: false, version: "1.2.3" },
        { name: "private", path: root, private: true, version: "1.0.0" },
      ],
    });

    assert.deepStrictEqual(manifest.packages[0], {
      changelog: "- Fixed it",
      file: "package-0000.tgz",
      name: "@acme/example",
      path: "packages/example",
      sha256: "8d5594eb4bf5ec277cad2e2b3f082170e7e490921a54bc712258a8b5cac6a842",
      version: "1.2.3",
    });

    const validated = validatePackageArtifact({
      directory: artifact,
      inspect: () => ({ name: "@acme/example", version: "1.2.3" }),
    });
    assert.deepStrictEqual(workspaceFromPackageArtifact(validated), [
      {
        name: "@acme/example",
        path: "packages/example",
        private: false,
        version: "1.2.3",
      },
    ]);
    assert.strictEqual(
      tarballForPackage(artifact, validated, "@acme/example"),
      resolve(realpathSync(artifact), "package-0000.tgz"),
    );
    assert.deepStrictEqual(publishSummary(validated, ["@acme/example"]), {
      publishedPackages: [{ name: "@acme/example", version: "1.2.3" }],
    });
  });
});

void test("rejects a tampered tarball", () => {
  fixture(({ artifact, root, workspace }) => {
    createPackageArtifact({
      directory: artifact,
      pack: (_packagePath, outputPath) => writeFileSync(outputPath, "original"),
      root,
      workspace: [{ name: "@acme/example", path: workspace, private: false, version: "1.2.3" }],
    });
    writeFileSync(join(artifact, "package-0000.tgz"), "tampered");

    assert.throws(
      () =>
        validatePackageArtifact({
          directory: artifact,
          inspect: () => ({ name: "@acme/example", version: "1.2.3" }),
        }),
      /SHA-256 mismatch/,
    );
  });
});

void test("rejects package metadata that differs from the trusted manifest", () => {
  fixture(({ artifact, root, workspace }) => {
    createPackageArtifact({
      directory: artifact,
      pack: (_packagePath, outputPath) => writeFileSync(outputPath, "original"),
      root,
      workspace: [{ name: "@acme/example", path: workspace, private: false, version: "1.2.3" }],
    });

    assert.throws(
      () =>
        validatePackageArtifact({
          directory: artifact,
          inspect: () => ({ name: "@attacker/package", version: "9.9.9" }),
        }),
      /package metadata mismatch/,
    );
  });
});
