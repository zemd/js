import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";

import type { FileChanges, GitHubApi } from "./github.ts";

export type GitRunner = (args: readonly string[]) => string;

const MAX_RELEASE_FILES = 1_000;
const MAX_RELEASE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_RELEASE_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_REPOSITORY_PATH_BYTES = 4_096;

export interface WorkingTreeOptions {
  readonly git: GitRunner;
  readonly root?: string;
  readonly workspacePaths: readonly string[];
}

const isWithin = (root: string, path: string): boolean => {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
};

const repositoryPath = (path: string): string => {
  if (
    path.length === 0 ||
    Buffer.byteLength(path) > MAX_REPOSITORY_PATH_BYTES ||
    path.includes("\\") ||
    isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path === "." ||
    path.startsWith("../")
  ) {
    throw new Error(`unsafe release path: ${JSON.stringify(path)}`);
  }
  return path;
};

const workspaceReleasePaths = (
  root: string,
  sourceRoot: string,
  workspacePaths: readonly string[],
): Set<string> => {
  const allowed = new Set(["pnpm-lock.yaml", ".changeset/ledger.yaml"]);

  for (const workspacePath of workspacePaths) {
    const absolute = resolve(workspacePath);
    if (!isWithin(sourceRoot, absolute)) {
      throw new Error(`workspace path is outside the repository: ${workspacePath}`);
    }

    const metadata = lstatSync(absolute);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`workspace path is not a regular directory: ${workspacePath}`);
    }

    const canonical = realpathSync(absolute);
    const expected = resolve(root, relative(sourceRoot, absolute));
    if (canonical !== expected || !isWithin(root, canonical)) {
      throw new Error(`workspace path traverses a symbolic link: ${workspacePath}`);
    }

    const directory = relative(root, canonical).split(sep).join("/");
    allowed.add(directory ? `${directory}/package.json` : "package.json");
    allowed.add(directory ? `${directory}/CHANGELOG.md` : "CHANGELOG.md");
  }

  return allowed;
};

const isChangesetDeletion = (path: string): boolean => {
  return /^\.changeset\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path);
};

const isPortablePackageMetadataPath = (path: string): boolean => {
  if (path === "package.json" || path === "CHANGELOG.md") return true;
  const segments = path.split("/");
  const filename = segments.pop();
  return (
    (filename === "package.json" || filename === "CHANGELOG.md") &&
    segments.length > 0 &&
    segments.every(
      (segment) =>
        segment !== "node_modules" &&
        !segment.startsWith(".") &&
        /^[A-Za-z0-9@_][A-Za-z0-9@._-]*$/.test(segment),
    )
  );
};

const isPortableReleaseAddition = (path: string): boolean => {
  return (
    path === "pnpm-lock.yaml" ||
    path === ".changeset/ledger.yaml" ||
    isPortablePackageMetadataPath(path)
  );
};

const readRegularFile = (root: string, path: string): Buffer => {
  const absolute = resolve(root, repositoryPath(path));
  if (!isWithin(root, absolute)) {
    throw new Error(`release path is outside the repository: ${path}`);
  }

  const before = lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`release path is not a regular file: ${path}`);
  }
  if (before.size > MAX_RELEASE_FILE_BYTES) {
    throw new Error(`release file is larger than ${MAX_RELEASE_FILE_BYTES} bytes: ${path}`);
  }

  const canonical = realpathSync(absolute);
  if (canonical !== absolute || !isWithin(root, canonical)) {
    throw new Error(`release path traverses a symbolic link: ${path}`);
  }

  const descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`release file changed while it was being opened: ${path}`);
    }
    if (opened.size > MAX_RELEASE_FILE_BYTES) {
      throw new Error(`release file is larger than ${MAX_RELEASE_FILE_BYTES} bytes: ${path}`);
    }
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

// The release versioner starts from a clean checkout and leaves only unstaged
// modifications, deletions, and newly-created changelogs. Reject every other
// porcelain state so conflicts, renames, copies, and type changes fail closed.
const changedPaths = (status: string): { additions: Set<string>; deletions: Set<string> } => {
  const additions = new Set<string>();
  const deletions = new Set<string>();

  for (const record of status.split("\0").filter(Boolean)) {
    if (record.length < 4 || record[2] !== " ") {
      throw new Error(`invalid git status record: ${JSON.stringify(record)}`);
    }

    const state = record.slice(0, 2);
    const path = repositoryPath(record.slice(3));
    if (state === " M" || state === "??") {
      additions.add(path);
    } else if (state === " D") {
      deletions.add(path);
    } else {
      throw new Error(`unexpected git status ${JSON.stringify(state)} for ${path}`);
    }
  }

  return { additions, deletions };
};

export const collectChanges = ({
  git,
  root = process.cwd(),
  workspacePaths,
}: WorkingTreeOptions): FileChanges => {
  const sourceRoot = resolve(root);
  const canonicalRoot = realpathSync(sourceRoot);
  const allowedAdditions = workspaceReleasePaths(canonicalRoot, sourceRoot, workspacePaths);
  const changed = changedPaths(git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]));

  if (changed.additions.size + changed.deletions.size > MAX_RELEASE_FILES) {
    throw new Error(`release contains more than ${MAX_RELEASE_FILES} files`);
  }

  let totalBytes = 0;
  const additions = [...changed.additions].map((path) => {
    if (!allowedAdditions.has(path)) {
      throw new Error(`unexpected release addition: ${path}`);
    }
    const contents = readRegularFile(canonicalRoot, path);
    totalBytes += contents.byteLength;
    if (totalBytes > MAX_RELEASE_TOTAL_BYTES) {
      throw new Error(`release contents exceed ${MAX_RELEASE_TOTAL_BYTES} bytes`);
    }
    return { path, contents: contents.toString("base64") };
  });

  const deletions = [...changed.deletions].map((path) => {
    if (!isChangesetDeletion(path)) {
      throw new Error(`unexpected release deletion: ${path}`);
    }
    return { path };
  });

  return { additions, deletions };
};

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context}: expected an object`);
  }
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  context: string,
) => {
  const actual = Object.keys(value).sort();
  if (actual.join("\0") !== [...expected].sort().join("\0")) {
    throw new Error(`${context}: expected only ${expected.join(", ")}`);
  }
};

export const parseFileChanges = (source: string): FileChanges => {
  const value = record(JSON.parse(source) as unknown, "release changes");
  exactKeys(value, ["additions", "deletions"], "release changes");
  if (!Array.isArray(value["additions"]) || !Array.isArray(value["deletions"])) {
    throw new Error("release changes: additions and deletions must be arrays");
  }
  if (value["additions"].length + value["deletions"].length > MAX_RELEASE_FILES) {
    throw new Error(`release contains more than ${MAX_RELEASE_FILES} files`);
  }

  const paths = new Set<string>();
  let totalBytes = 0;
  const additions = value["additions"].map((entry, index) => {
    const item = record(entry, `release changes.additions[${index}]`);
    exactKeys(item, ["contents", "path"], `release changes.additions[${index}]`);
    if (typeof item["path"] !== "string" || typeof item["contents"] !== "string") {
      throw new Error(`release changes.additions[${index}]: path and contents must be strings`);
    }
    const path = repositoryPath(item["path"]);
    if (!isPortableReleaseAddition(path)) {
      throw new Error(`unexpected release addition: ${path}`);
    }
    if (paths.has(path)) throw new Error(`duplicate release path: ${path}`);
    paths.add(path);

    const contents = Buffer.from(item["contents"], "base64");
    if (contents.toString("base64") !== item["contents"]) {
      throw new Error(`release changes.additions[${index}]: contents are not canonical base64`);
    }
    if (contents.byteLength > MAX_RELEASE_FILE_BYTES) {
      throw new Error(`release file is larger than ${MAX_RELEASE_FILE_BYTES} bytes: ${path}`);
    }
    totalBytes += contents.byteLength;
    if (totalBytes > MAX_RELEASE_TOTAL_BYTES) {
      throw new Error(`release contents exceed ${MAX_RELEASE_TOTAL_BYTES} bytes`);
    }
    return { path, contents: item["contents"] };
  });

  const deletions = value["deletions"].map((entry, index) => {
    const item = record(entry, `release changes.deletions[${index}]`);
    exactKeys(item, ["path"], `release changes.deletions[${index}]`);
    if (typeof item["path"] !== "string") {
      throw new Error(`release changes.deletions[${index}]: path must be a string`);
    }
    const path = repositoryPath(item["path"]);
    if (!isChangesetDeletion(path)) {
      throw new Error(`unexpected release deletion: ${path}`);
    }
    if (paths.has(path)) throw new Error(`duplicate release path: ${path}`);
    paths.add(path);
    return { path };
  });

  return { additions, deletions };
};

export interface SignedCommitInput {
  readonly api: GitHubApi;
  readonly baseOid: string;
  readonly branch: string;
  readonly message: string;
  readonly changes: FileChanges;
}

// Publishes prevalidated release changes as a single commit on `branch`.
export const createSignedCommit = async ({
  api,
  baseOid,
  branch,
  message,
  changes,
}: SignedCommitInput): Promise<string> => {
  if (changes.additions.length === 0 && changes.deletions.length === 0) {
    throw new Error("nothing to commit");
  }
  if (!/^[0-9a-f]{40}$/i.test(baseOid)) {
    throw new Error(`expected a 40-character commit SHA, got ${JSON.stringify(baseOid)}`);
  }

  // The API commit is built on top of the triggering commit, so the remote
  // branch has to be reset to that same commit first.
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
