export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string;
}

export type BumpType = "major" | "minor" | "patch" | "prerelease";

const SEMVER = /^\d+\.\d+\.\d+$/;

export const isReleaseVersion = (version: string): boolean => SEMVER.test(version);

export const parseVersion = (version: string): SemVer => {
  const [core = "", ...prerelease] = version.split("-");
  const [major = 0, minor = 0, patch = 0] = core.split(".").map(Number);
  return { major, minor, patch, prerelease: prerelease.join("-") };
};

export const bumpType = (from: string, to: string): BumpType => {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (b.prerelease || a.prerelease) return "prerelease";
  if (b.major !== a.major) return "major";
  if (b.minor !== a.minor) return "minor";
  return "patch";
};
