import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
  planContractVersion,
  reconcileContractRelease,
  type ChangeIntent,
  type ContractVersionPlan,
} from "../contract-version";
import { parseAppliedReleases } from "../pnpm";
import type { Command } from "./command";

interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly private: true;
}

const parseManifest = (source: string, path: string): PackageManifest => {
  const value: unknown = JSON.parse(source);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}: expected a package manifest object`);
  }

  const manifest = value as Record<string, unknown>;
  if (typeof manifest["name"] !== "string" || typeof manifest["version"] !== "string") {
    throw new Error(`${path}: expected string name and version fields`);
  }
  if (manifest["private"] !== true) {
    throw new Error(`${path}: contract version preparation is restricted to private packages`);
  }

  return {
    name: manifest["name"],
    version: manifest["version"],
    private: true,
  };
};

const replaceManifestVersion = (
  source: string,
  currentVersion: string,
  newVersion: string,
  path: string,
): string => {
  const property = /("version"\s*:\s*")([^"]*)(")/g;
  const matches = [...source.matchAll(property)];
  if (matches.length !== 1 || matches[0]?.[2] !== currentVersion) {
    throw new Error(`${path}: could not replace the unique version field`);
  }
  return source.replace(property, `$1${newVersion}$3`);
};

const readIntents = (directory: string): readonly ChangeIntent[] =>
  readdirSync(directory)
    .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
    .sort()
    .map((file) => ({
      id: basename(file, ".md"),
      source: readFileSync(join(directory, file), "utf8"),
    }));

const parsePlan = (source: string, path: string): ContractVersionPlan | undefined => {
  const value: unknown = JSON.parse(source);
  if (value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path}: expected a contract version plan or null`);
  }

  const plan = value as Record<string, unknown>;
  const bump = plan["bump"];
  if (
    typeof plan["name"] !== "string" ||
    typeof plan["currentVersion"] !== "string" ||
    typeof plan["newVersion"] !== "string" ||
    (bump !== "major" && bump !== "minor" && bump !== "patch") ||
    !Array.isArray(plan["intentIds"]) ||
    !plan["intentIds"].every((id) => typeof id === "string")
  ) {
    throw new Error(`${path}: invalid contract version plan`);
  }

  return {
    name: plan["name"],
    currentVersion: plan["currentVersion"],
    newVersion: plan["newVersion"],
    bump,
    intentIds: plan["intentIds"],
  };
};

const prepare = (packagePath: string, intentsDirectory: string, statePath: string): void => {
  const manifestSource = readFileSync(packagePath, "utf8");
  const manifest = parseManifest(manifestSource, packagePath);
  const plan = planContractVersion(manifest, readIntents(intentsDirectory));

  writeFileSync(statePath, `${JSON.stringify(plan ?? null, undefined, 2)}\n`);
  if (!plan) return;

  writeFileSync(
    packagePath,
    replaceManifestVersion(manifestSource, plan.currentVersion, plan.newVersion, packagePath),
  );
};

const finalize = (statePath: string, releasesPath: string): void => {
  const plan = parsePlan(readFileSync(statePath, "utf8"), statePath);
  if (!plan) return;

  const releases = parseAppliedReleases(readFileSync(releasesPath, "utf8"));
  writeFileSync(
    releasesPath,
    `${JSON.stringify(reconcileContractRelease(releases, plan), undefined, 2)}\n`,
  );
};

export const contractVersion: Command = {
  usage:
    "prepare <package.json> <intents-dir> <state.json> | finalize <state.json> <releases.json>",
  run: (argv) => {
    const [operation, firstPath, secondPath, thirdPath] = argv;

    if (operation === "prepare" && firstPath && secondPath && thirdPath) {
      prepare(firstPath, secondPath, thirdPath);
      return;
    }
    if (operation === "finalize" && firstPath && secondPath && !thirdPath) {
      finalize(firstPath, secondPath);
      return;
    }

    throw new Error(
      "usage: contract-version prepare <package.json> <intents-dir> <state.json> | " +
        "finalize <state.json> <releases.json>",
    );
  },
};
