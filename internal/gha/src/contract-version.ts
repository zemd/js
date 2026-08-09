import type { AppliedRelease } from "./pnpm";
import { isReleaseVersion, parseVersion } from "./semver";

export type ContractBump = "major" | "minor" | "patch";

export interface ChangeIntent {
  readonly id: string;
  readonly source: string;
}

export interface ContractPackage {
  readonly name: string;
  readonly version: string;
}

export interface ContractVersionPlan {
  readonly name: string;
  readonly currentVersion: string;
  readonly newVersion: string;
  readonly bump: ContractBump;
  readonly intentIds: readonly string[];
}

const BUMP_PRIORITY: Readonly<Record<ContractBump, number>> = {
  patch: 0,
  minor: 1,
  major: 2,
};

const scalar = (value: string): string => {
  const trimmed = value.trim();
  const quote = trimmed.at(0);

  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const frontmatter = (source: string): string => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? "";
};

const packageBump = (source: string, packageName: string): ContractBump | undefined => {
  for (const line of frontmatter(source).split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0 || scalar(line.slice(0, separator)) !== packageName) continue;

    const bump = scalar(line.slice(separator + 1));
    if (bump === "major" || bump === "minor" || bump === "patch") return bump;
  }

  return undefined;
};

export const bumpContractVersion = (version: string, bump: ContractBump): string => {
  if (!isReleaseVersion(version)) {
    throw new Error(`contract version must be plain semver, got "${version}"`);
  }

  const parsed = parseVersion(version);
  if (bump === "major") return `${parsed.major + 1}.0.0`;
  if (bump === "minor") return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
};

export const planContractVersion = (
  manifest: ContractPackage,
  intents: readonly ChangeIntent[],
): ContractVersionPlan | undefined => {
  const releases = intents.flatMap((intent) => {
    const bump = packageBump(intent.source, manifest.name);
    return bump === undefined ? [] : [{ id: intent.id, bump }];
  });
  if (releases.length === 0) return undefined;

  const bump = releases.reduce<ContractBump>(
    (highest, release) =>
      BUMP_PRIORITY[release.bump] > BUMP_PRIORITY[highest] ? release.bump : highest,
    releases[0]?.bump ?? "patch",
  );

  return {
    name: manifest.name,
    currentVersion: manifest.version,
    newVersion: bumpContractVersion(manifest.version, bump),
    bump,
    intentIds: releases.map(({ id }) => id).sort(),
  };
};

export const reconcileContractRelease = (
  releases: readonly AppliedRelease[],
  plan: ContractVersionPlan,
): readonly AppliedRelease[] => {
  const matching = releases.filter(({ name }) => name === plan.name);
  if (matching.length !== 1) {
    throw new Error(
      `pnpm version reported ${matching.length} releases for ${plan.name}; expected exactly one`,
    );
  }

  const release = matching[0];
  if (!release) throw new Error(`pnpm version did not report ${plan.name}`);

  if (release.currentVersion === plan.currentVersion && release.newVersion === plan.newVersion) {
    return releases;
  }
  if (release.currentVersion !== plan.newVersion || release.newVersion !== plan.newVersion) {
    throw new Error(
      `pnpm version reported an unexpected ${plan.name} transition: ` +
        `${release.currentVersion} -> ${release.newVersion}; expected ` +
        `${plan.newVersion} -> ${plan.newVersion}`,
    );
  }

  return releases.map((entry) =>
    entry === release ? { ...entry, currentVersion: plan.currentVersion } : entry,
  );
};
