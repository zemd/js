import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  BUNDLE_FILENAME,
  checkSynchronizedBundle,
  expectedBundleContents,
  parseSyncMode,
  runSyncCli,
  SYNC_INSTRUCTION,
  type SyncIo,
  type SyncPaths,
} from "./sync.ts";

interface Fixture {
  readonly repository: string;
  readonly paths: SyncPaths;
  readonly targetBundle: string;
}

const git = (cwd: string, args: readonly string[]): Buffer => {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: null,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      TMPDIR: "/tmp",
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.strictEqual(
    result.status,
    0,
    `git ${args[0] ?? "command"} failed: ${result.stderr?.toString("utf8") ?? ""}`,
  );
  return result.stdout ?? Buffer.alloc(0);
};

const fixture = (context: TestContext): Fixture => {
  const repository = mkdtempSync(join(tmpdir(), "zemd-gha-sync-"));
  context.after(() => rmSync(repository, { recursive: true, force: true }));
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.email", "sync@example.test"]);
  git(repository, ["config", "user.name", "GHA Sync Test"]);
  git(repository, ["config", "commit.gpgsign", "false"]);

  const paths: SyncPaths = {
    distDirectory: join(repository, "dist"),
    targetDirectory: join(repository, ".github", "scripts"),
  };
  mkdirSync(paths.distDirectory, { recursive: true });
  mkdirSync(paths.targetDirectory, { recursive: true });
  writeFileSync(join(paths.distDirectory, BUNDLE_FILENAME), "export const bundled = true;\n");
  const targetBundle = join(paths.targetDirectory, BUNDLE_FILENAME);
  writeFileSync(targetBundle, expectedBundleContents(paths));
  writeFileSync(join(repository, ".gitignore"), "dist/\n");
  git(repository, ["add", "-A", "--", "."]);
  git(repository, ["commit", "--quiet", "-m", "generated fixture"]);
  return { repository, paths, targetBundle };
};

const messages = (): { io: SyncIo; logs: string[]; errors: string[] } => {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    io: {
      log: (message): void => {
        logs.push(message);
      },
      error: (message): void => {
        errors.push(message);
      },
    },
    logs,
    errors,
  };
};

void test("parses only write mode or --check", () => {
  assert.strictEqual(parseSyncMode([]), "write");
  assert.strictEqual(parseSyncMode(["--check"]), "check");
  assert.throws(() => parseSyncMode(["--write"]), /Unknown sync argument/);
  assert.throws(() => parseSyncMode(["--check", "extra"]), /Unknown sync argument/);
});

void test("sync check succeeds without changing bytes, metadata, or Git status", (context) => {
  const { repository, paths, targetBundle } = fixture(context);
  const bytesBefore = readFileSync(targetBundle);
  const modifiedBefore = statSync(targetBundle, { bigint: true }).mtimeNs;
  const statusBefore = git(repository, ["status", "--porcelain=v1", "-z"]);
  const output = messages();

  assert.strictEqual(runSyncCli(["--check"], paths, output.io), 0);
  assert.deepStrictEqual(readFileSync(targetBundle), bytesBefore);
  assert.strictEqual(statSync(targetBundle, { bigint: true }).mtimeNs, modifiedBefore);
  assert.deepStrictEqual(git(repository, ["status", "--porcelain=v1", "-z"]), statusBefore);
  assert.match(output.logs.join("\n"), /verified gha\.mjs/);
});

void test("sync check reports missing, stale, and unexpected generated files without writing", (context) => {
  const stale = fixture(context);
  writeFileSync(stale.targetBundle, "stale bytes\n");
  const staleBytes = readFileSync(stale.targetBundle);
  const staleStatus = git(stale.repository, ["status", "--porcelain=v1", "-z"]);
  const staleOutput = messages();
  assert.strictEqual(runSyncCli(["--check"], stale.paths, staleOutput.io), 1);
  assert.deepStrictEqual(readFileSync(stale.targetBundle), staleBytes);
  assert.deepStrictEqual(git(stale.repository, ["status", "--porcelain=v1", "-z"]), staleStatus);
  assert.match(staleOutput.errors.join("\n"), /stale/);
  assert.ok(staleOutput.errors.join("\n").includes(SYNC_INSTRUCTION));

  const missing = fixture(context);
  rmSync(missing.targetBundle);
  const missingStatus = git(missing.repository, ["status", "--porcelain=v1", "-z"]);
  assert.throws(() => checkSynchronizedBundle(missing.paths), /missing/);
  assert.strictEqual(existsSync(missing.targetBundle), false);
  assert.deepStrictEqual(
    git(missing.repository, ["status", "--porcelain=v1", "-z"]),
    missingStatus,
  );

  const unexpected = fixture(context);
  writeFileSync(join(unexpected.paths.targetDirectory, "old-bundle.mjs"), "unexpected\n");
  const unexpectedStatus = git(unexpected.repository, ["status", "--porcelain=v1", "-z"]);
  assert.throws(() => checkSynchronizedBundle(unexpected.paths), /unexpected generated entries/);
  assert.ok(existsSync(join(unexpected.paths.targetDirectory, "old-bundle.mjs")));
  assert.deepStrictEqual(
    git(unexpected.repository, ["status", "--porcelain=v1", "-z"]),
    unexpectedStatus,
  );
});

void test("stale pre-push sync-check fails without rewriting the bundle", (context) => {
  const { repository, paths, targetBundle } = fixture(context);
  writeFileSync(targetBundle, "stale pre-push bundle\n");
  const bytesBefore = readFileSync(targetBundle);
  const statusBefore = git(repository, ["status", "--porcelain=v1", "-z"]);

  assert.strictEqual(runSyncCli(["--check"], paths, messages().io), 1);
  assert.deepStrictEqual(readFileSync(targetBundle), bytesBefore);
  assert.deepStrictEqual(git(repository, ["status", "--porcelain=v1", "-z"]), statusBefore);
});

void test("write-mode sync regenerates the exact bundle and removes old output", (context) => {
  const { paths, targetBundle } = fixture(context);
  writeFileSync(targetBundle, "stale\n");
  mkdirSync(join(paths.targetDirectory, "old-layout"));
  writeFileSync(join(paths.targetDirectory, "old-layout", "chunk.mjs"), "old\n");

  assert.strictEqual(runSyncCli([], paths, messages().io), 0);
  assert.deepStrictEqual(readFileSync(targetBundle), expectedBundleContents(paths));
  assert.deepStrictEqual(readdirSync(paths.targetDirectory), [BUNDLE_FILENAME]);
});
