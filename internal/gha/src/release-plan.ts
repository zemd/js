import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { isPublicWorkspacePackage } from "./pnpm.ts";
import type { WorkspacePackage } from "./pnpm.ts";
import { isReleaseVersion } from "./semver.ts";

const MAX_ARTIFACT_BYTES = 1024 * 1024;
const MAX_PACKAGES = 100;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const PACKAGE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export interface ReleasePlanPackage {
  readonly name: string;
  readonly version: string;
}

export interface ReleasePlanArtifact {
  readonly contractVersion: string;
  readonly packages: readonly ReleasePlanPackage[];
}

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
): void => {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    throw new Error(`${context}: expected only ${expected.join(", ")}`);
  }
};

const stringField = (value: Record<string, unknown>, key: string, context: string): string => {
  const field = value[key];
  if (typeof field !== "string") throw new Error(`${context}.${key}: expected a string`);
  return field;
};

const validateNameVersion = (name: string, version: string, context: string): void => {
  if (name.length > 214 || !PACKAGE_NAME.test(name)) {
    throw new Error(`${context}: invalid npm package name ${JSON.stringify(name)}`);
  }
  if (!PACKAGE_VERSION.test(version)) {
    throw new Error(`${context}: invalid npm package version ${JSON.stringify(version)}`);
  }
};

const validatePlan = (plan: ReleasePlanArtifact): ReleasePlanArtifact => {
  if (plan.contractVersion !== "" && !isReleaseVersion(plan.contractVersion)) {
    throw new Error(
      `release plan: expected an empty or plain semver contract version, got ${JSON.stringify(plan.contractVersion)}`,
    );
  }
  if (plan.packages.length > MAX_PACKAGES) {
    throw new Error(`release plan must contain at most ${MAX_PACKAGES} packages`);
  }

  const names = new Set<string>();
  for (const [index, packageRelease] of plan.packages.entries()) {
    const context = `release plan.packages[${index}]`;
    validateNameVersion(packageRelease.name, packageRelease.version, context);
    if (names.has(packageRelease.name)) {
      throw new Error(`${context}: duplicate package name ${JSON.stringify(packageRelease.name)}`);
    }
    names.add(packageRelease.name);
  }
  return plan;
};

export const createReleasePlan = (
  workspace: readonly WorkspacePackage[],
  contractVersion = "",
): ReleasePlanArtifact =>
  validatePlan({
    contractVersion,
    packages: workspace
      .filter(isPublicWorkspacePackage)
      .map(({ name, version }) => ({ name, version }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  });

export const parseReleasePlan = (source: string): ReleasePlanArtifact => {
  if (Buffer.byteLength(source) > MAX_ARTIFACT_BYTES) {
    throw new Error(`release plan exceeds ${MAX_ARTIFACT_BYTES} bytes`);
  }

  const value = record(JSON.parse(source) as unknown, "release plan");
  exactKeys(value, ["contractVersion", "packages"], "release plan");
  if (!Array.isArray(value["packages"])) {
    throw new Error("release plan.packages: expected an array");
  }

  const packages = value["packages"].map((entry, index) => {
    const context = `release plan.packages[${index}]`;
    const item = record(entry, context);
    exactKeys(item, ["name", "version"], context);
    return {
      name: stringField(item, "name", context),
      version: stringField(item, "version", context),
    };
  });

  return validatePlan({
    contractVersion: stringField(value, "contractVersion", "release plan"),
    packages,
  });
};

const artifactDirectory = (path: string): string => {
  const absolute = resolve(path);
  const metadata = lstatSync(absolute);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${path} must be a regular directory`);
  }
  return realpathSync(absolute);
};

export const createReleasePlanArtifact = (
  directoryPath: string,
  workspace: readonly WorkspacePackage[],
  contractVersion = "",
): ReleasePlanArtifact => {
  const directory = artifactDirectory(directoryPath);
  if (readdirSync(directory).length !== 0) {
    throw new Error("release plan artifact directory is not empty");
  }

  const plan = createReleasePlan(workspace, contractVersion);
  writeFileSync(resolve(directory, "release-plan.json"), `${JSON.stringify(plan)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return plan;
};

export const validateReleasePlanArtifact = (directoryPath: string): ReleasePlanArtifact => {
  const directory = artifactDirectory(directoryPath);
  const entries = readdirSync(directory);
  if (entries.length !== 1 || entries[0] !== "release-plan.json") {
    throw new Error("release plan artifact must contain only release-plan.json");
  }

  const planPath = resolve(directory, "release-plan.json");
  const metadata = lstatSync(planPath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size === 0 ||
    metadata.size > MAX_ARTIFACT_BYTES
  ) {
    throw new Error(
      `release-plan.json must be a non-empty regular file of at most ${MAX_ARTIFACT_BYTES} bytes`,
    );
  }
  return parseReleasePlan(readFileSync(planPath, "utf8"));
};

export const releasePlanWorkspace = (plan: ReleasePlanArtifact): readonly WorkspacePackage[] =>
  plan.packages.map(({ name, version }) => ({ name, version, path: ".", private: false }));
