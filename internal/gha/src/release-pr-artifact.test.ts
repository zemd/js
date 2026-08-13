import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createReleasePrArtifact, readReleasePrArtifact } from "./release-pr-artifact.ts";

const fixture = <T>(
  run: (paths: { artifact: string; body: string; root: string; workspace: string }) => T,
): T => {
  const root = mkdtempSync(join(tmpdir(), "gha-release-pr-artifact-"));
  const workspace = join(root, "packages", "a");
  const artifact = join(root, "artifact");
  const body = join(root, "body.md");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(artifact);
  writeFileSync(join(workspace, "package.json"), '{"name":"a"}\n');
  writeFileSync(body, "Release body\n");
  try {
    return run({ artifact, body, root, workspace });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

void test("round-trips a bounded release pull-request artifact", () => {
  fixture(({ artifact, body, root, workspace }) => {
    createReleasePrArtifact({
      artifactDirectory: artifact,
      git: () => " M packages/a/package.json\0",
      prBodyPath: body,
      root,
      workspacePaths: [workspace],
    });

    const parsed = readReleasePrArtifact(artifact);
    assert.strictEqual(parsed.changes.additions[0]?.path, "packages/a/package.json");
    assert.strictEqual(readFileSync(parsed.bodyPath, "utf8"), "Release body\n");
  });
});

void test("rejects extra files in a credentialed release artifact", () => {
  fixture(({ artifact, body, root, workspace }) => {
    createReleasePrArtifact({
      artifactDirectory: artifact,
      git: () => " M packages/a/package.json\0",
      prBodyPath: body,
      root,
      workspacePaths: [workspace],
    });
    writeFileSync(join(artifact, "unexpected"), "nope");
    assert.throws(() => {
      readReleasePrArtifact(artifact);
    }, /must contain only/);
  });
});

void test("rejects a symbolic-link pull-request body", () => {
  fixture(({ artifact, body, root, workspace }) => {
    rmSync(body);
    symlinkSync(join(workspace, "package.json"), body);
    assert.throws(() => {
      createReleasePrArtifact({
        artifactDirectory: artifact,
        git: () => " M packages/a/package.json\0",
        prBodyPath: body,
        root,
        workspacePaths: [workspace],
      });
    }, /regular file/);
  });
});
