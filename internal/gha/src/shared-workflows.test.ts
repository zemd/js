import assert from "node:assert/strict";
import { test } from "node:test";

import {
  releaseSharedWorkflows,
  renderSharedReleaseBody,
  sharedWorkflowReleasePending,
} from "./shared-workflows.ts";
import { fakeGitHub } from "./testing/fake-github.ts";

const SHA = "a".repeat(40);
const WORKFLOWS = ["shared-ci.yml", "shared-release.yml"];

void test("renders copy-paste pins for every shared workflow", () => {
  const body = renderSharedReleaseBody({
    repository: "zemd/js",
    version: "1.2.3",
    sha: SHA,
    workflows: WORKFLOWS,
  });

  assert.ok(body.includes(`uses: zemd/js/.github/workflows/shared-ci.yml@${SHA} # v1.2.3`));
  assert.ok(body.includes(`uses: zemd/js/.github/workflows/shared-release.yml@${SHA} # v1.2.3`));
  assert.ok(body.includes("gh api repos/zemd/js/git/ref/tags/v1 --jq .object.sha"));
  assert.ok(body.includes(`https://github.com/zemd/js/tree/${SHA}/.github/workflows-examples`));
});

void test("includes the changelog entry and the generated notes", () => {
  const body = renderSharedReleaseBody({
    repository: "zemd/js",
    version: "1.2.3",
    sha: SHA,
    workflows: WORKFLOWS,
    changelog: "- Added an input.",
    notes: "## What's Changed\n\n- #1",
  });

  assert.ok(body.includes("## Changes"));
  assert.ok(body.includes("- Added an input."));
  assert.ok(body.includes("- #1"));
});

void test("creates the exact tag and moves the major tag", async () => {
  const github = fakeGitHub({ repository: "zemd/js" });

  await releaseSharedWorkflows({
    api: github.api,
    sha: SHA,
    version: "2.1.0",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  });

  assert.deepStrictEqual(github.createdRefs, [
    { ref: "refs/tags/v2.1.0", sha: SHA },
    { ref: "refs/tags/v2", sha: SHA },
  ]);
  assert.deepStrictEqual(github.updatedRefs, []);
  assert.strictEqual(github.createdReleases[0]?.tag, "v2.1.0");
  assert.strictEqual(github.createdReleases[0]?.name, "Shared workflows v2.1.0");
});

void test("is a no-op when the version was already released", async () => {
  const github = fakeGitHub({
    existingTags: ["v1.0.0", "v1"],
    releases: [{ tag_name: "v1.0.0", created_at: "2026-08-01T00:00:00Z" }],
  });

  await releaseSharedWorkflows({
    api: github.api,
    sha: SHA,
    version: "1.0.0",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  });

  assert.deepStrictEqual(github.createdRefs, []);
  assert.deepStrictEqual(github.createdReleases, []);
});

void test("treats the exact GitHub release as shared workflow completion", async () => {
  assert.strictEqual(await sharedWorkflowReleasePending(fakeGitHub().api, "1.2.3"), true);
  assert.strictEqual(
    await sharedWorkflowReleasePending(
      fakeGitHub({
        releases: [{ tag_name: "v1.2.3", created_at: "2026-08-29T00:00:00Z" }],
      }).api,
      "1.2.3",
    ),
    false,
  );
  assert.strictEqual(
    await sharedWorkflowReleasePending(
      fakeGitHub({
        releases: [{ tag_name: "v1.2.2", created_at: "2026-08-29T00:00:00Z" }],
      }).api,
      "1.2.3",
    ),
    true,
  );
});

void test("resumes after moving the major tag fails", async () => {
  const github = fakeGitHub({
    existingTags: ["v2"],
    updateRefFailures: { "refs/tags/v2": 1 },
  });
  const input = {
    api: github.api,
    sha: SHA,
    version: "2.1.0",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  };

  await assert.rejects(releaseSharedWorkflows(input), /could not move the major tag/);

  assert.strictEqual(github.tags.has("v2.1.0"), true);
  assert.deepStrictEqual(github.createdReleases, []);

  await releaseSharedWorkflows(input);

  assert.deepStrictEqual(github.createdRefs, [{ ref: "refs/tags/v2.1.0", sha: SHA }]);
  assert.deepStrictEqual(github.updatedRefs, [{ ref: "refs/tags/v2", sha: SHA }]);
  assert.strictEqual(github.createdReleases.length, 1);
});

void test("resumes after creating the GitHub release fails", async () => {
  const github = fakeGitHub({ releaseCreationFailures: 1 });
  const input = {
    api: github.api,
    sha: SHA,
    version: "3.0.0",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  };

  await assert.rejects(releaseSharedWorkflows(input), /failed to create release/);

  assert.strictEqual(github.tags.has("v3.0.0"), true);
  assert.strictEqual(github.tags.has("v3"), true);
  assert.deepStrictEqual(github.createdReleases, []);

  await releaseSharedWorkflows(input);

  assert.deepStrictEqual(github.createdRefs, [
    { ref: "refs/tags/v3.0.0", sha: SHA },
    { ref: "refs/tags/v3", sha: SHA },
  ]);
  assert.deepStrictEqual(github.updatedRefs, [{ ref: "refs/tags/v3", sha: SHA }]);
  assert.strictEqual(github.createdReleases.length, 1);
});

void test("moves an existing major tag instead of failing", async () => {
  const github = fakeGitHub({ existingTags: ["v2"] });

  await releaseSharedWorkflows({
    api: github.api,
    sha: SHA,
    version: "2.0.1",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  });

  assert.deepStrictEqual(github.updatedRefs, [{ ref: "refs/tags/v2", sha: SHA }]);
});

void test("refuses a prerelease version", async () => {
  const github = fakeGitHub();

  await assert.rejects(
    releaseSharedWorkflows({
      api: github.api,
      sha: SHA,
      version: "1.0.0-beta.1",
      packagePath: "internal/gha",
      workflows: WORKFLOWS,
    }),
    /plain semver/,
  );
});

void test("refuses to release when no shared workflows were found", async () => {
  const github = fakeGitHub();

  await assert.rejects(
    releaseSharedWorkflows({
      api: github.api,
      sha: SHA,
      version: "1.0.0",
      packagePath: "internal/gha",
      workflows: [],
    }),
    /no shared-\*\.yml workflows found/,
  );
});
