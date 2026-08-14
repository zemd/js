import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  collectChanges,
  createSignedCommit,
  parseFileChanges,
  type GitRunner,
} from "./signed-commit.ts";
import { fakeGitHub } from "./testing/fake-github.ts";

const SHA = "a".repeat(40);

const gitStub = (status: string): GitRunner => {
  return (args) => {
    if (args[0] === "status") return status;
    throw new Error(`unexpected git ${args.join(" ")}`);
  };
};

const repository = <T>(run: (root: string, workspace: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), "gha-signed-commit-"));
  const workspace = join(root, "packages", "a");
  mkdirSync(join(root, ".changeset"), { recursive: true });
  mkdirSync(workspace, { recursive: true });
  writeFileSync(join(workspace, "package.json"), '{"name":"a"}\n');
  try {
    return run(root, workspace);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
};

void test("collects only expected modified and generated release files", () => {
  repository((root, workspace) => {
    writeFileSync(join(workspace, "CHANGELOG.md"), "# Changelog\n");
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

    const changes = collectChanges({
      git: gitStub(
        " M packages/a/package.json\0?? packages/a/CHANGELOG.md\0 M pnpm-lock.yaml\0 D .changeset/old-intent.md\0",
      ),
      root,
      workspacePaths: [workspace],
    });

    assert.deepStrictEqual(
      changes.additions.map(({ path }) => path),
      ["packages/a/package.json", "packages/a/CHANGELOG.md", "pnpm-lock.yaml"],
    );
    assert.deepStrictEqual(changes.deletions, [{ path: ".changeset/old-intent.md" }]);
    assert.strictEqual(
      Buffer.from(changes.additions[0]?.contents ?? "", "base64").toString(),
      '{"name":"a"}\n',
    );
  });
});

void test("rejects unexpected additions, deletions, and porcelain states", () => {
  repository((root, workspace) => {
    writeFileSync(join(root, "README.md"), "changed\n");
    assert.throws(() => {
      collectChanges({
        git: gitStub(" M README.md\0"),
        root,
        workspacePaths: [workspace],
      });
    }, /unexpected release addition: README\.md/);
    assert.throws(() => {
      collectChanges({
        git: gitStub(" D packages/a/package.json\0"),
        root,
        workspacePaths: [workspace],
      });
    }, /unexpected release deletion/);
    assert.throws(() => {
      collectChanges({
        git: gitStub("R  packages/a/CHANGELOG.md\0old.md\0"),
        root,
        workspacePaths: [workspace],
      });
    }, /unexpected git status/);
  });
});

void test("rejects a release file that is a symbolic link", () => {
  const outside = mkdtempSync(join(tmpdir(), "gha-signed-commit-outside-"));
  try {
    writeFileSync(join(outside, "secret"), "AUDIT_CANARY\n");
    repository((root, workspace) => {
      symlinkSync(join(outside, "secret"), join(workspace, "CHANGELOG.md"));
      assert.throws(() => {
        collectChanges({
          git: gitStub("?? packages/a/CHANGELOG.md\0"),
          root,
          workspacePaths: [workspace],
        });
      }, /not a regular file/);
    });
  } finally {
    rmSync(outside, { force: true, recursive: true });
  }
});

void test(
  "rejects a symlink to the runner process environment",
  { skip: !existsSync("/proc/self/environ") },
  () => {
    repository((root, workspace) => {
      symlinkSync("/proc/self/environ", join(workspace, "CHANGELOG.md"));
      assert.throws(() => {
        collectChanges({
          git: gitStub("?? packages/a/CHANGELOG.md\0"),
          root,
          workspacePaths: [workspace],
        });
      }, /not a regular file/);
    });
  },
);

void test("rejects a workspace directory reached through a symbolic link", () => {
  const outside = mkdtempSync(join(tmpdir(), "gha-signed-workspace-outside-"));
  try {
    writeFileSync(join(outside, "package.json"), '{"name":"outside"}\n');
    repository((root) => {
      const linkedWorkspace = join(root, "packages", "linked");
      symlinkSync(outside, linkedWorkspace);
      assert.throws(() => {
        collectChanges({
          git: gitStub(" M packages/linked/package.json\0"),
          root,
          workspacePaths: [linkedWorkspace],
        });
      }, /regular directory|symbolic link/);
    });
  } finally {
    rmSync(outside, { force: true, recursive: true });
  }
});

void test("rejects oversized release files before reading them", () => {
  repository((root, workspace) => {
    const changelog = join(workspace, "CHANGELOG.md");
    writeFileSync(changelog, "");
    truncateSync(changelog, 10 * 1024 * 1024 + 1);
    assert.throws(() => {
      collectChanges({
        git: gitStub("?? packages/a/CHANGELOG.md\0"),
        root,
        workspacePaths: [workspace],
      });
    }, /larger than/);
  });
});

void test("validates credentialed release-change artifacts independently", () => {
  const changes = parseFileChanges(
    JSON.stringify({
      additions: [
        {
          path: "packages/a/package.json",
          contents: Buffer.from('{"name":"a"}\n').toString("base64"),
        },
      ],
      deletions: [{ path: ".changeset/old-intent.md" }],
    }),
  );
  assert.strictEqual(changes.additions[0]?.path, "packages/a/package.json");

  for (const source of [
    { additions: [{ path: ".github/workflows/release.yml", contents: "" }], deletions: [] },
    { additions: [{ path: "../package.json", contents: "" }], deletions: [] },
    { additions: [{ path: "packages/a/package.json", contents: "not-base64" }], deletions: [] },
    { additions: [], deletions: [{ path: "packages/a/package.json" }] },
  ]) {
    assert.throws(() => {
      parseFileChanges(JSON.stringify(source));
    });
  }
});

void test("refuses to commit an unchanged release artifact", async () => {
  const github = fakeGitHub();

  await assert.rejects(
    createSignedCommit({
      api: github.api,
      baseOid: SHA,
      branch: "release/main",
      message: "chore(release): version packages",
      changes: { additions: [], deletions: [] },
    }),
    /nothing to commit/,
  );
});

void test("points the branch at the triggering SHA before committing", async () => {
  const github = fakeGitHub();

  const oid = await createSignedCommit({
    api: github.api,
    baseOid: SHA,
    branch: "release/main",
    message: "chore(release): version packages",
    changes: { additions: [{ path: "package.json", contents: "" }], deletions: [] },
  });

  assert.deepStrictEqual(github.createdRefs, [{ ref: "refs/heads/release/main", sha: SHA }]);
  assert.strictEqual(oid, "commit-oid");
});

void test("force-resets an existing release branch to the triggering SHA", async () => {
  const github = fakeGitHub({ refusedRefs: ["refs/heads/release/main"] });

  await createSignedCommit({
    api: github.api,
    baseOid: SHA,
    branch: "release/main",
    message: "chore(release): version packages",
    changes: { additions: [{ path: "package.json", contents: "" }], deletions: [] },
  });

  assert.deepStrictEqual(github.updatedRefs, [{ ref: "refs/heads/release/main", sha: SHA }]);
});

void test("rejects a non-commit base identifier", async () => {
  const github = fakeGitHub();
  await assert.rejects(
    createSignedCommit({
      api: github.api,
      baseOid: "deadbeef",
      branch: "release/main",
      message: "chore(release): version packages",
      changes: { additions: [{ path: "package.json", contents: "" }], deletions: [] },
    }),
    /40-character commit SHA/,
  );
});
