import { expect, test } from "vitest";

import { collectChanges, createSignedCommit, type GitRunner } from "./signed-commit";
import { fakeGitHub } from "./testing/fake-github";

const gitStub = (status: string, head = "abc123"): GitRunner => {
  return (args) => {
    if (args[0] === "status") return status;
    if (args[0] === "rev-parse") return `${head}\n`;
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
};

const read = (path: string): Buffer => Buffer.from(`contents of ${path}`);

test("collects modified and untracked files as additions", () => {
  const changes = collectChanges({
    git: gitStub(" M packages/a/package.json\0?? packages/b/CHANGELOG.md\0"),
    read,
  });

  expect(changes.additions.map((entry) => entry.path)).toEqual([
    "packages/a/package.json",
    "packages/b/CHANGELOG.md",
  ]);
  expect(changes.deletions).toEqual([]);
  expect(changes.additions[0]?.contents).toBe(
    Buffer.from("contents of packages/a/package.json").toString("base64"),
  );
});

test("records a deletion", () => {
  const changes = collectChanges({ git: gitStub(" D packages/a/old.ts\0"), read });

  expect(changes.additions).toEqual([]);
  expect(changes.deletions).toEqual([{ path: "packages/a/old.ts" }]);
});

// A rename record is followed by an extra NUL separated record holding the
// original path, which must not be mistaken for another change.
test("splits a rename into an addition and a deletion", () => {
  const changes = collectChanges({ git: gitStub("R  new.ts\0old.ts\0"), read });

  expect(changes.additions.map((entry) => entry.path)).toEqual(["new.ts"]);
  expect(changes.deletions).toEqual([{ path: "old.ts" }]);
});

test("splits a work-tree rename into an addition and a deletion", () => {
  const changes = collectChanges({ git: gitStub(" R new.ts\0old.ts\0"), read });

  expect(changes.additions.map((entry) => entry.path)).toEqual(["new.ts"]);
  expect(changes.deletions).toEqual([{ path: "old.ts" }]);
});

test("treats a copy as an addition only", () => {
  const changes = collectChanges({ git: gitStub("C  copy.ts\0source.ts\0"), read });

  expect(changes.additions.map((entry) => entry.path)).toEqual(["copy.ts"]);
  expect(changes.deletions).toEqual([]);
});

test("treats a work-tree copy as an addition only", () => {
  const changes = collectChanges({ git: gitStub(" C copy.ts\0source.ts\0"), read });

  expect(changes.additions.map((entry) => entry.path)).toEqual(["copy.ts"]);
  expect(changes.deletions).toEqual([]);
});

test("refuses to commit an unchanged working tree", async () => {
  const github = fakeGitHub();

  await expect(
    createSignedCommit({
      api: github.api,
      git: gitStub(""),
      branch: "release/main",
      message: "chore(release): version packages",
      changes: { additions: [], deletions: [] },
    }),
  ).rejects.toThrow(/nothing to commit/);
});

test("points the branch at HEAD before committing on top of it", async () => {
  const github = fakeGitHub();

  const oid = await createSignedCommit({
    api: github.api,
    git: gitStub("", "deadbeef"),
    branch: "release/main",
    message: "chore(release): version packages",
    changes: { additions: [{ path: "a", contents: "" }], deletions: [] },
  });

  expect(github.createdRefs).toEqual([{ ref: "refs/heads/release/main", sha: "deadbeef" }]);
  expect(oid).toBe("commit-oid");
});

test("force-resets the branch when it already exists", async () => {
  const github = fakeGitHub({ refusedRefs: ["refs/heads/release/main"] });

  await createSignedCommit({
    api: github.api,
    git: gitStub("", "deadbeef"),
    branch: "release/main",
    message: "chore(release): version packages",
    changes: { additions: [{ path: "a", contents: "" }], deletions: [] },
  });

  expect(github.updatedRefs).toEqual([{ ref: "refs/heads/release/main", sha: "deadbeef" }]);
});
