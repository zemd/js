import { expect, test } from "vitest";

import {
  nextReleaseTag,
  previousReleaseTag,
  releasePublishedPackages,
  renderCombinedReleaseBody,
} from "./github-releases";
import { fakeGitHub } from "./testing/fake-github";

const SHA = "b".repeat(40);
const NOW = new Date("2026-08-05T09:41:07.000Z");

test("renders one npm link and one changelog block per package", () => {
  const body = renderCombinedReleaseBody({
    published: [{ name: "@acme/one", version: "1.0.0" }],
    paths: new Map([["@acme/one", "/nowhere"]]),
    notes: "## What's Changed",
  });

  expect(body).toContain("| [`@acme/one`](https://www.npmjs.com/package/@acme/one) | `1.0.0` |");
  expect(body).toContain("<summary><code>@acme/one@1.0.0</code></summary>");
  expect(body).toContain("_No changelog entry recorded._");
  expect(body).toContain("## What's Changed");
});

test("builds a minute-stamped release tag", async () => {
  const github = fakeGitHub();

  expect(await nextReleaseTag(github.api, NOW)).toBe("release-2026-08-05-0941");
});

test("suffixes the release tag when the minute is taken", async () => {
  const github = fakeGitHub({
    existingTags: ["release-2026-08-05-0941", "release-2026-08-05-0941.2"],
  });

  expect(await nextReleaseTag(github.api, NOW)).toBe("release-2026-08-05-0941.3");
});

test("picks the newest previous combined release", async () => {
  const github = fakeGitHub({
    releases: [
      { tag_name: "release-2026-01-01-0000", created_at: "2026-01-01T00:00:00Z" },
      { tag_name: "v1.0.0", created_at: "2026-07-01T00:00:00Z" },
      { tag_name: "release-2026-06-01-0000", created_at: "2026-06-01T00:00:00Z" },
    ],
  });

  expect(await previousReleaseTag(github.api)).toBe("release-2026-06-01-0000");
});

test("tags every published package and creates one combined release", async () => {
  const github = fakeGitHub();

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [
      { name: "@acme/two", version: "2.0.0" },
      { name: "@acme/one", version: "1.0.0" },
    ],
    workspace: [],
    now: NOW,
  });

  expect(github.createdRefs.map((entry) => entry.ref)).toEqual([
    "refs/tags/@acme/one@1.0.0",
    "refs/tags/@acme/two@2.0.0",
  ]);
  expect(github.createdReleases[0]?.tag).toBe("release-2026-08-05-0941");
  expect(github.createdReleases[0]?.prerelease).toBe(false);
});

test("marks the release as a prerelease when every version is one", async () => {
  const github = fakeGitHub();

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [{ name: "@acme/one", version: "1.0.0-beta.1" }],
    workspace: [],
    now: NOW,
  });

  expect(github.createdReleases[0]?.prerelease).toBe(true);
});

test("skips a package tag that already exists", async () => {
  const github = fakeGitHub({
    existingTags: ["@acme/one@1.0.0"],
    refusedRefs: ["refs/tags/@acme/one@1.0.0"],
  });

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [{ name: "@acme/one", version: "1.0.0" }],
    workspace: [],
    now: NOW,
  });

  expect(github.createdReleases).toHaveLength(1);
});

test("does nothing when pnpm published nothing", async () => {
  const github = fakeGitHub();

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [],
    workspace: [],
    now: NOW,
  });

  expect(github.createdRefs).toEqual([]);
  expect(github.createdReleases).toEqual([]);
});

test("fails the run when the release cannot be created", async () => {
  const github = fakeGitHub({ refuseReleaseCreation: true });

  await expect(
    releasePublishedPackages({
      api: github.api,
      sha: SHA,
      published: [{ name: "@acme/one", version: "1.0.0" }],
      workspace: [],
      now: NOW,
    }),
  ).rejects.toThrow(/one or more release steps failed/);
});
