#!/usr/bin/env node
// Renders the body of the automated release pull request from the releases
// applied by `pnpm version -r --json` and the current workspace package list.
//
// Usage: node .github/scripts/release-pr-body.mjs <releases.json> <workspace-list.json>
// where the first file is written by `pnpm version -r --json` and the second
// is the output of `pnpm list -r --depth -1 --json`.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** @param {string} version */
const parseVersion = (version) => {
  const [core = "", ...prerelease] = version.split("-");
  const [major = 0, minor = 0, patch = 0] = core.split(".").map(Number);
  return { major, minor, patch, prerelease: prerelease.join("-") };
};

/**
 * @param {string} from
 * @param {string} to
 */
const bumpType = (from, to) => {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (b.prerelease || a.prerelease) return "prerelease";
  if (b.major !== a.major) return "major";
  if (b.minor !== a.minor) return "minor";
  return "patch";
};

/**
 * @param {string} packagePath
 * @param {string} version
 */
const changelogEntry = (packagePath, version) => {
  let changelog;
  try {
    changelog = readFileSync(join(packagePath, "CHANGELOG.md"), "utf8");
  } catch {
    return "";
  }
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim().replace(/[[\]]/g, "") === `## ${version}`);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  // Headings would render oversized inside <details>, so demote them to bold.
  return (end === -1 ? rest : rest.slice(0, end))
    .join("\n")
    .replace(/^#{1,6}\s+(.+)$/gm, "**$1**")
    .trim();
};

const badge = {
  major: "**major**",
  minor: "**minor**",
  patch: "patch",
  prerelease: "prerelease",
  new: "first release",
};

/**
 * @param {Array<{ name: string, currentVersion: string, newVersion: string }>} applied
 * @param {Array<{ name: string, path: string, private?: boolean }>} workspace
 */
export const renderReleasePrBody = (applied, workspace) => {
  const packages = new Map(
    workspace.filter((entry) => !entry.private).map((entry) => [entry.name, entry]),
  );
  const releases = applied
    .map((release) => {
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
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const out = [];

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
      const entry = changelogEntry(release.path, release.to);
      const transition = release.from
        ? `${release.from} &rarr; <b>${release.to}</b>`
        : `<b>${release.to}</b>`;
      out.push("<details>");
      out.push(
        `<summary><code>${release.name}</code> &nbsp;&middot;&nbsp; ${transition}</summary>`,
      );
      out.push("");
      out.push("<br>");
      out.push("");
      out.push(entry || "_No changelog entry recorded._");
      out.push("");
      out.push("</details>");
      out.push("");
    }
  }

  out.push("");

  return `${out.join("\n")}\n`;
};

const main = () => {
  const [releasesPath, workspacePath] = process.argv.slice(2);

  if (!releasesPath || !workspacePath) {
    console.error("usage: release-pr-body.mjs <releases.json> <workspace-list.json>");
    process.exit(1);
  }

  /** @type {Array<{ name: string, currentVersion: string, newVersion: string }>} */
  const releases = JSON.parse(readFileSync(releasesPath, "utf8"));
  /** @type {Array<{ name: string, path: string, private?: boolean }>} */
  const workspace = JSON.parse(readFileSync(workspacePath, "utf8"));

  process.stdout.write(renderReleasePrBody(releases, workspace));
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
