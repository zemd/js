import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FileChanges } from "./github.ts";
import { collectChanges, parseFileChanges, type GitRunner } from "./signed-commit.ts";

const CHANGE_FILE = "changes.json";
const BODY_FILE = "pr-body.md";
const MAX_BODY_BYTES = 1024 * 1024;

const regularFile = (path: string, maxBytes: number): void => {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maxBytes) {
    throw new Error(`${path} must be a regular file of at most ${maxBytes} bytes`);
  }
  realpathSync(path);
};

const artifactDirectory = (path: string, expectedEntries: readonly string[]): string => {
  const absolute = resolve(path);
  const metadata = lstatSync(absolute);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${path} must be a regular directory`);
  }
  const entries = readdirSync(absolute).sort();
  if (entries.join("\0") !== [...expectedEntries].sort().join("\0")) {
    throw new Error(`${path} must contain only ${expectedEntries.join(" and ")}`);
  }
  return realpathSync(absolute);
};

export interface CreateReleasePrArtifactInput {
  readonly artifactDirectory: string;
  readonly git: GitRunner;
  readonly prBodyPath: string;
  readonly root?: string;
  readonly workspacePaths: readonly string[];
}

export const createReleasePrArtifact = ({
  artifactDirectory: output,
  git,
  prBodyPath,
  root = process.cwd(),
  workspacePaths,
}: CreateReleasePrArtifactInput): void => {
  const directory = artifactDirectory(output, []);
  regularFile(prBodyPath, MAX_BODY_BYTES);
  const body = readFileSync(prBodyPath);
  const changes = collectChanges({ git, root, workspacePaths });

  writeFileSync(resolve(directory, CHANGE_FILE), `${JSON.stringify(changes)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  writeFileSync(resolve(directory, BODY_FILE), body, { flag: "wx", mode: 0o600 });
};

export interface ReleasePrArtifact {
  readonly bodyPath: string;
  readonly changes: FileChanges;
}

export const readReleasePrArtifact = (path: string): ReleasePrArtifact => {
  const directory = artifactDirectory(path, [BODY_FILE, CHANGE_FILE]);
  const changesPath = resolve(directory, CHANGE_FILE);
  const bodyPath = resolve(directory, BODY_FILE);
  regularFile(changesPath, 70 * 1024 * 1024);
  regularFile(bodyPath, MAX_BODY_BYTES);

  return {
    bodyPath,
    changes: parseFileChanges(readFileSync(changesPath, "utf8")),
  };
};
