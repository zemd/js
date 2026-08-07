import { changelogEntry } from "./changelog";
import type { AppliedRelease, WorkspacePackage } from "./pnpm";
import { bumpType } from "./semver";

type ReleaseKind = "major" | "minor" | "patch" | "prerelease" | "new";

interface PreparedRelease {
  readonly name: string;
  readonly path: string;
  readonly from: string | undefined;
  readonly to: string;
  readonly kind: ReleaseKind;
  readonly internal: boolean;
}

const badge: Record<ReleaseKind, string> = {
  major: "**major**",
  minor: "**minor**",
  patch: "patch",
  prerelease: "prerelease",
  new: "first release",
};

const prepare = (
  applied: readonly AppliedRelease[],
  workspace: readonly WorkspacePackage[],
): readonly PreparedRelease[] => {
  const packages = new Map(workspace.map((entry) => [entry.name, entry]));

  return applied
    .map((release): PreparedRelease => {
      const entry = packages.get(release.name);
      if (!entry) {
        throw new Error(`release package ${release.name} is missing from the workspace snapshot`);
      }
      const firstRelease = release.currentVersion === release.newVersion;
      return {
        name: release.name,
        path: entry.path,
        from: firstRelease ? undefined : release.currentVersion,
        to: release.newVersion,
        kind: firstRelease ? "new" : bumpType(release.currentVersion, release.newVersion),
        internal: entry.private,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const changelogDetails = (out: string[], release: PreparedRelease): void => {
  const transition = release.from
    ? `${release.from} &rarr; <b>${release.to}</b>`
    : `<b>${release.to}</b>`;

  out.push("<details>");
  out.push(`<summary><code>${release.name}</code> &nbsp;&middot;&nbsp; ${transition}</summary>`);
  out.push("");
  out.push("<br>");
  out.push("");
  out.push(changelogEntry(release.path, release.to) || "_No changelog entry recorded._");
  out.push("");
  out.push("</details>");
  out.push("");
};

export const renderReleasePrBody = (
  applied: readonly AppliedRelease[],
  workspace: readonly WorkspacePackage[],
): string => {
  const prepared = prepare(applied, workspace);
  const releases = prepared.filter((release) => !release.internal);
  const internal = prepared.filter((release) => release.internal);

  const out: string[] = [];

  out.push("## Release summary");
  out.push("");

  if (releases.length === 0) {
    out.push("No publishable packages were prepared for release.");
  } else {
    const count = releases.length;
    out.push(
      `\`pnpm version -r\` consumed the pending change intents and prepared **${count}** package${count === 1 ? "" : "s"} for release.`,
    );
    out.push("Merging this pull request publishes the versions listed below.");
    out.push("");
    out.push("| Package | Bump | Current | Next |");
    out.push("| :--- | :---: | ---: | ---: |");

    for (const release of releases) {
      const current = release.from ? `\`${release.from}\`` : "—";
      out.push(`| \`${release.name}\` | ${badge[release.kind]} | ${current} | \`${release.to}\` |`);
    }

    out.push("");
    out.push("### Changelogs");
    out.push("");

    for (const release of releases) {
      changelogDetails(out, release);
    }
  }

  // Private packages never reach npm, but @zemd/gha carries the shared workflow
  // contract version, so a reviewer still needs to see it move.
  if (internal.length > 0) {
    out.push("");
    out.push("### Internal packages");
    out.push("");
    out.push("Not published to npm.");
    out.push("");
    out.push("| Package | Bump | Current | Next |");
    out.push("| :--- | :---: | ---: | ---: |");

    for (const release of internal) {
      const current = release.from ? `\`${release.from}\`` : "—";
      out.push(`| \`${release.name}\` | ${badge[release.kind]} | ${current} | \`${release.to}\` |`);
    }

    out.push("");

    for (const release of internal) {
      changelogDetails(out, release);
    }
  }

  out.push("");

  return `${out.join("\n")}\n`;
};
