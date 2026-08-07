import { readFileSync } from "node:fs";

import type { FileChanges, GitHubApi } from "./github";

export type GitRunner = (args: readonly string[]) => string;
export type FileReader = (path: string) => Buffer;

export interface WorkingTreeOptions {
  readonly git: GitRunner;
  readonly read?: FileReader;
}

// `-z` records are NUL separated; a rename record is followed by an extra
// record holding the original path.
export const collectChanges = ({ git, read }: WorkingTreeOptions): FileChanges => {
  const records = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
    .split("\0")
    .filter(Boolean);

  const added = new Set<string>();
  const deleted = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? "";
    const state = record.slice(0, 2);
    const path = record.slice(3);

    if (state.includes("R") || state.includes("C")) {
      const origin = records[index + 1];
      index += 1;
      if (state.includes("R") && origin) deleted.add(origin);
      added.add(path);
      continue;
    }

    if (state.includes("D")) {
      deleted.add(path);
      continue;
    }

    added.add(path);
  }

  const readFile: FileReader = read ?? ((path) => readFileSync(path));

  return {
    additions: [...added].map((path) => ({
      path,
      contents: readFile(path).toString("base64"),
    })),
    deletions: [...deleted].map((path) => ({ path })),
  };
};

export interface SignedCommitInput {
  readonly api: GitHubApi;
  readonly git: GitRunner;
  readonly branch: string;
  readonly message: string;
  readonly changes: FileChanges;
}

// Publishes the current working-tree changes as a single commit on `branch`.
export const createSignedCommit = async ({
  api,
  git,
  branch,
  message,
  changes,
}: SignedCommitInput): Promise<string> => {
  if (changes.additions.length === 0 && changes.deletions.length === 0) {
    throw new Error("nothing to commit");
  }

  // The API commit is built on top of the checked-out commit, so the remote
  // branch has to be reset to that same commit first.
  const baseOid = git(["rev-parse", "HEAD"]).trim();
  const ref = `refs/heads/${branch}`;

  const created = await api.createRef(ref, baseOid);
  if (!created.ok) {
    const updated = await api.updateRef(ref, baseOid);
    if (!updated.ok) {
      throw new Error(
        `failed to point ${branch} at ${baseOid}: ${JSON.stringify(updated.payload)}`,
      );
    }
  }

  return api.createCommitOnBranch(branch, baseOid, message, changes);
};
