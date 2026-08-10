import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextReleaseTag,
  previousReleaseTag,
  releasePublishedPackages,
  renderCombinedReleaseBody,
} from "./github-releases.ts";
import { fakeGitHub } from "./testing/fake-github.ts";

const SHA = "b".repeat(40);
const NOW = new Date("2026-08-05T09:41:07.000Z");

void test("renders one npm link and one changelog block per package", () => {
  const body = renderCombinedReleaseBody({
    published: [{ name: "@acme/one", version: "1.0.0" }],
    paths: new Map([["@acme/one", "/nowhere"]]),
    notes: "## What's Changed",
  });

  assert.ok(body.includes("| [`@acme/one`](https://www.npmjs.com/package/@acme/one) | `1.0.0` |"));
  assert.ok(body.includes("<summary><code>@acme/one@1.0.0</code></summary>"));
  assert.ok(body.includes("_No changelog entry recorded._"));
  assert.ok(body.includes("## What's Changed"));
});

void test("labels packages that still require npm staged-publish approval", () => {
  const body = renderCombinedReleaseBody({
    published: [],
    staged: [{ name: "@acme/one", version: "1.0.0" }],
    paths: new Map(),
  });

  assert.ok(body.includes("## Packages staged on npm"));
  assert.ok(body.includes("require maintainer approval with 2FA"));
  assert.ok(body.includes("does not roll back this release or make its version reusable"));
  assert.ok(!body.includes("## Published packages"));
});

void test("separates directly published first releases from staged updates", () => {
  const body = renderCombinedReleaseBody({
    published: [{ name: "@acme/new", version: "1.0.0" }],
    staged: [{ name: "@acme/existing", version: "2.0.0" }],
    paths: new Map(),
  });

  assert.ok(body.includes("## Published packages"));
  assert.ok(body.includes("| [`@acme/new`](https://www.npmjs.com/package/@acme/new) | `1.0.0` |"));
  assert.ok(body.includes("## Packages staged on npm"));
  assert.ok(
    body.includes("| [`@acme/existing`](https://www.npmjs.com/package/@acme/existing) | `2.0.0` |"),
  );
});

void test("builds a minute-stamped release tag", async () => {
  const github = fakeGitHub();

  assert.strictEqual(await nextReleaseTag(github.api, NOW), "release-2026-08-05-0941");
});

void test("suffixes the release tag when the minute is taken", async () => {
  const github = fakeGitHub({
    existingTags: ["release-2026-08-05-0941", "release-2026-08-05-0941.2"],
  });

  assert.strictEqual(await nextReleaseTag(github.api, NOW), "release-2026-08-05-0941.3");
});

void test("picks the newest previous combined release", async () => {
  const github = fakeGitHub({
    releases: [
      { tag_name: "release-2026-01-01-0000", created_at: "2026-01-01T00:00:00Z" },
      { tag_name: "v1.0.0", created_at: "2026-07-01T00:00:00Z" },
      { tag_name: "release-2026-06-01-0000", created_at: "2026-06-01T00:00:00Z" },
    ],
  });

  assert.strictEqual(await previousReleaseTag(github.api), "release-2026-06-01-0000");
});

void test("tags every submitted package and creates one combined release", async () => {
  const github = fakeGitHub();

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [
      { name: "@acme/two", version: "2.0.0" },
      { name: "@acme/one", version: "1.0.0" },
    ],
    staged: [{ name: "@acme/staged", version: "3.0.0" }],
    workspace: [],
    now: NOW,
  });

  assert.deepStrictEqual(
    github.createdRefs.map((entry) => entry.ref),
    ["refs/tags/@acme/one@1.0.0", "refs/tags/@acme/staged@3.0.0", "refs/tags/@acme/two@2.0.0"],
  );
  assert.strictEqual(github.createdReleases[0]?.tag, "release-2026-08-05-0941");
  assert.strictEqual(github.createdReleases[0]?.prerelease, false);
  assert.ok(github.createdReleases[0]?.body.includes("## Packages staged on npm"));
});

void test("marks the release as a prerelease when every version is one", async () => {
  const github = fakeGitHub();

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [{ name: "@acme/one", version: "1.0.0-beta.1" }],
    workspace: [],
    now: NOW,
  });

  assert.strictEqual(github.createdReleases[0]?.prerelease, true);
});

void test("skips a package tag that already exists", async () => {
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

  assert.strictEqual(github.createdReleases.length, 1);
});

void test("does nothing when pnpm published nothing", async () => {
  const github = fakeGitHub();

  await releasePublishedPackages({
    api: github.api,
    sha: SHA,
    published: [],
    workspace: [],
    now: NOW,
  });

  assert.deepStrictEqual(github.createdRefs, []);
  assert.deepStrictEqual(github.createdReleases, []);
});

void test("fails the run when the release cannot be created", async () => {
  const github = fakeGitHub({ refuseReleaseCreation: true });

  await assert.rejects(
    releasePublishedPackages({
      api: github.api,
      sha: SHA,
      published: [{ name: "@acme/one", version: "1.0.0" }],
      workspace: [],
      now: NOW,
    }),
    /one or more release steps failed/,
  );
});
