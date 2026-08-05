import { expect, test } from "vitest";

import { releaseSharedWorkflows, renderSharedReleaseBody } from "./shared-workflows";
import { fakeGitHub } from "./testing/fake-github";

const SHA = "a".repeat(40);
const WORKFLOWS = ["shared-ci.yml", "shared-release.yml"];

test("renders copy-paste pins for every shared workflow", () => {
  const body = renderSharedReleaseBody({
    repository: "zemd/js",
    version: "1.2.3",
    sha: SHA,
    workflows: WORKFLOWS,
  });

  expect(body).toContain(`uses: zemd/js/.github/workflows/shared-ci.yml@${SHA} # v1.2.3`);
  expect(body).toContain(`uses: zemd/js/.github/workflows/shared-release.yml@${SHA} # v1.2.3`);
  expect(body).toContain("gh api repos/zemd/js/git/ref/tags/v1 --jq .object.sha");
  expect(body).toContain(`https://github.com/zemd/js/tree/${SHA}/.github/workflows-examples`);
});

test("includes the changelog entry and the generated notes", () => {
  const body = renderSharedReleaseBody({
    repository: "zemd/js",
    version: "1.2.3",
    sha: SHA,
    workflows: WORKFLOWS,
    changelog: "- Added an input.",
    notes: "## What's Changed\n\n- #1",
  });

  expect(body).toContain("## Changes");
  expect(body).toContain("- Added an input.");
  expect(body).toContain("- #1");
});

test("creates the exact tag and moves the major tag", async () => {
  const github = fakeGitHub({ repository: "zemd/js" });

  await releaseSharedWorkflows({
    api: github.api,
    sha: SHA,
    version: "2.1.0",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  });

  expect(github.createdRefs).toEqual([
    { ref: "refs/tags/v2.1.0", sha: SHA },
    { ref: "refs/tags/v2", sha: SHA },
  ]);
  expect(github.updatedRefs).toEqual([]);
  expect(github.createdReleases[0]?.tag).toBe("v2.1.0");
  expect(github.createdReleases[0]?.name).toBe("Shared workflows v2.1.0");
});

test("is a no-op when the version was already released", async () => {
  const github = fakeGitHub({ existingTags: ["v1.0.0"] });

  await releaseSharedWorkflows({
    api: github.api,
    sha: SHA,
    version: "1.0.0",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  });

  expect(github.createdRefs).toEqual([]);
  expect(github.createdReleases).toEqual([]);
});

test("moves an existing major tag instead of failing", async () => {
  const github = fakeGitHub({ refusedRefs: ["refs/tags/v2"] });

  await releaseSharedWorkflows({
    api: github.api,
    sha: SHA,
    version: "2.0.1",
    packagePath: "internal/gha",
    workflows: WORKFLOWS,
  });

  expect(github.updatedRefs).toEqual([{ ref: "refs/tags/v2", sha: SHA }]);
});

test("refuses a prerelease version", async () => {
  const github = fakeGitHub();

  await expect(
    releaseSharedWorkflows({
      api: github.api,
      sha: SHA,
      version: "1.0.0-beta.1",
      packagePath: "internal/gha",
      workflows: WORKFLOWS,
    }),
  ).rejects.toThrow(/plain semver/);
});

test("refuses to release when no shared workflows were found", async () => {
  const github = fakeGitHub();

  await expect(
    releaseSharedWorkflows({
      api: github.api,
      sha: SHA,
      version: "1.0.0",
      packagePath: "internal/gha",
      workflows: [],
    }),
  ).rejects.toThrow(/no shared-\*\.yml workflows found/);
});
