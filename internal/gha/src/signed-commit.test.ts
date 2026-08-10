import assert from "node:assert/strict";
import { test } from "node:test";

import { collectChanges, createSignedCommit, type GitRunner } from "./signed-commit.ts";
import { fakeGitHub } from "./testing/fake-github.ts";

const gitStub = (status: string, head = "abc123"): GitRunner => {
  return (args) => {
    if (args[0] === "status") return status;
    if (args[0] === "rev-parse") return `${head}\n`;
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
};

const read = (path: string): Buffer => Buffer.from(`contents of ${path}`);

void test("collects modified and untracked files as additions", () => {
  const changes = collectChanges({
    git: gitStub(" M packages/a/package.json\0?? packages/b/CHANGELOG.md\0"),
    read,
  });

  assert.deepStrictEqual(
    changes.additions.map((entry) => entry.path),
    ["packages/a/package.json", "packages/b/CHANGELOG.md"],
  );
  assert.deepStrictEqual(changes.deletions, []);
  assert.strictEqual(
    changes.additions[0]?.contents,
    Buffer.from("contents of packages/a/package.json").toString("base64"),
  );
});

void test("records a deletion", () => {
  const changes = collectChanges({ git: gitStub(" D packages/a/old.ts\0"), read });

  assert.deepStrictEqual(changes.additions, []);
  assert.deepStrictEqual(changes.deletions, [{ path: "packages/a/old.ts" }]);
});

// A rename record is followed by an extra NUL separated record holding the
// original path, which must not be mistaken for another change.
void test("splits a rename into an addition and a deletion", () => {
  const changes = collectChanges({ git: gitStub("R  new.ts\0old.ts\0"), read });

  assert.deepStrictEqual(
    changes.additions.map((entry) => entry.path),
    ["new.ts"],
  );
  assert.deepStrictEqual(changes.deletions, [{ path: "old.ts" }]);
});

void test("splits a work-tree rename into an addition and a deletion", () => {
  const changes = collectChanges({ git: gitStub(" R new.ts\0old.ts\0"), read });

  assert.deepStrictEqual(
    changes.additions.map((entry) => entry.path),
    ["new.ts"],
  );
  assert.deepStrictEqual(changes.deletions, [{ path: "old.ts" }]);
});

void test("treats a copy as an addition only", () => {
  const changes = collectChanges({ git: gitStub("C  copy.ts\0source.ts\0"), read });

  assert.deepStrictEqual(
    changes.additions.map((entry) => entry.path),
    ["copy.ts"],
  );
  assert.deepStrictEqual(changes.deletions, []);
});

void test("treats a work-tree copy as an addition only", () => {
  const changes = collectChanges({ git: gitStub(" C copy.ts\0source.ts\0"), read });

  assert.deepStrictEqual(
    changes.additions.map((entry) => entry.path),
    ["copy.ts"],
  );
  assert.deepStrictEqual(changes.deletions, []);
});

void test("refuses to commit an unchanged working tree", async () => {
  const github = fakeGitHub();

  await assert.rejects(
    createSignedCommit({
      api: github.api,
      git: gitStub(""),
      branch: "release/main",
      message: "chore(release): version packages",
      changes: { additions: [], deletions: [] },
    }),
    /nothing to commit/,
  );
});

void test("points the branch at HEAD before committing on top of it", async () => {
  const github = fakeGitHub();

  const oid = await createSignedCommit({
    api: github.api,
    git: gitStub("", "deadbeef"),
    branch: "release/main",
    message: "chore(release): version packages",
    changes: { additions: [{ path: "a", contents: "" }], deletions: [] },
  });

  assert.deepStrictEqual(github.createdRefs, [{ ref: "refs/heads/release/main", sha: "deadbeef" }]);
  assert.strictEqual(oid, "commit-oid");
});

void test("force-resets the branch when it already exists", async () => {
  const github = fakeGitHub({ refusedRefs: ["refs/heads/release/main"] });

  await createSignedCommit({
    api: github.api,
    git: gitStub("", "deadbeef"),
    branch: "release/main",
    message: "chore(release): version packages",
    changes: { additions: [{ path: "a", contents: "" }], deletions: [] },
  });

  assert.deepStrictEqual(github.updatedRefs, [{ ref: "refs/heads/release/main", sha: "deadbeef" }]);
});
