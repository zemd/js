#!/usr/bin/env node
// Renders the body of the automated release pull request by diffing the
// workspace package versions captured before and after `pnpm version -r`.
//
// Usage: node .github/scripts/release-pr-body.mjs <before.json> <after.json>
// where each file is the output of `pnpm list -r --depth -1 --json`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const [beforePath, afterPath] = process.argv.slice(2);

if (!beforePath || !afterPath) {
  console.error("usage: release-pr-body.mjs <before.json> <after.json>");
  process.exit(1);
}

/** @param {string} file */
const readSnapshot = (file) => {
  /** @type {Array<{ name: string, version: string, path: string, private: boolean }>} */
  const entries = JSON.parse(readFileSync(file, "utf8"));
  return new Map(entries.filter((entry) => !entry.private).map((entry) => [entry.name, entry]));
};

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

const before = readSnapshot(beforePath);
const after = readSnapshot(afterPath);

const releases = [...after.values()]
  .map((entry) => ({
    name: entry.name,
    path: entry.path,
    from: before.get(entry.name)?.version,
    to: entry.version,
  }))
  .filter((release) => release.from !== release.to)
  .sort((a, b) => a.name.localeCompare(b.name));

const badge = {
  major: "**major**",
  minor: "**minor**",
  patch: "patch",
  prerelease: "prerelease",
  new: "first release",
};

const out = [];

out.push("## Release summary");
out.push("");

if (releases.length === 0) {
  out.push("No publishable package versions changed.");
} else {
  const count = releases.length;
  out.push(
    `\`pnpm version -r\` consumed the pending change intents and bumped **${count}** package${count === 1 ? "" : "s"}.`,
  );
  out.push("Merging this pull request publishes the versions listed below.");
  out.push("");
  out.push("| Package | Bump | Current | Next |");
  out.push("| :--- | :---: | ---: | ---: |");

  for (const release of releases) {
    const kind = release.from ? bumpType(release.from, release.to) : "new";
    const current = release.from ? `\`${release.from}\`` : "—";
    out.push(`| \`${release.name}\` | ${badge[kind]} | ${current} | \`${release.to}\` |`);
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
    out.push(`<summary><code>${release.name}</code> &nbsp;&middot;&nbsp; ${transition}</summary>`);
    out.push("");
    out.push(entry || "_No changelog entry recorded._");
    out.push("");
    out.push("</details>");
    out.push("");
  }
}

out.push("---");
out.push("");

process.stdout.write(`${out.join("\n")}\n`);
