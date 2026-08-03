#!/usr/bin/env node
// Tags the published commit once per package and publishes a single combined
// GitHub release for the run. `pnpm publish` only talks to the registry, it
// neither tags the commit nor creates releases. The release body lists every
// published package with its changelog entry, followed by GitHub's own
// automated release notes for the commits since the previous combined release.
//
// Usage: node .github/scripts/github-releases.mjs <publish-summary.json> <workspace-list.json>
// where the first file is written by `pnpm publish --report-summary` and the
// second is the output of `pnpm list -r --depth -1 --json`.
// Requires GITHUB_TOKEN (contents: write), GITHUB_REPOSITORY and GITHUB_SHA.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RELEASE_TAG_PREFIX = "release-";

const [summaryPath, workspacePath] = process.argv.slice(2);

if (!summaryPath || !workspacePath) {
  console.error("usage: github-releases.mjs <publish-summary.json> <workspace-list.json>");
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";

if (!token || !repository || !sha) {
  console.error("GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA must be set");
  process.exit(1);
}

/**
 * @param {string} path
 * @param {"GET" | "POST"} method
 * @param {unknown} [body]
 */
const api = async (path, method, body) => {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return { ok: response.ok, status: response.status, payload };
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

/** @param {string} tag */
const tagExists = async (tag) => {
  const response = await api(`/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`, "GET");
  return response.ok;
};

/** @param {string} tag */
const createTag = async (tag) => {
  const response = await api(`/repos/${repository}/git/refs`, "POST", {
    ref: `refs/tags/${tag}`,
    sha,
  });
  if (response.ok) {
    console.log(`created tag ${tag}`);
    return true;
  }
  if (response.status === 422 && (await tagExists(tag))) {
    console.log(`tag ${tag} already exists, skipping`);
    return true;
  }
  console.error(`failed to create tag ${tag}:`, response.payload);
  return false;
};

// Tag of the previous combined release, so the generated notes cover exactly
// the commits released since then.
const previousReleaseTag = async () => {
  const response = await api(`/repos/${repository}/releases?per_page=100`, "GET");
  if (!response.ok) return "";
  /** @type {Array<{ tag_name: string, created_at: string }>} */
  const releases = response.payload;
  return (
    releases
      .filter((release) => release.tag_name.startsWith(RELEASE_TAG_PREFIX))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.tag_name ?? ""
  );
};

// Same notes GitHub renders behind "Generate release notes" in the UI.
/**
 * @param {string} tag
 * @param {string} previousTag
 */
const generatedNotes = async (tag, previousTag) => {
  const response = await api(`/repos/${repository}/releases/generate-notes`, "POST", {
    tag_name: tag,
    target_commitish: sha,
    ...(previousTag ? { previous_tag_name: previousTag } : {}),
  });
  if (!response.ok) {
    console.warn(`failed to generate notes for ${tag}:`, response.payload);
    return "";
  }
  return (response.payload.body ?? "").trim();
};

// `release-YYYY-MM-DD-HHmm`, suffixed with `.2`, `.3`, ... when that tag is
// taken (git tags cannot contain `:`, hence the compact time).
const nextReleaseTag = async () => {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const base = `${RELEASE_TAG_PREFIX}${stamp}`;
  for (let counter = 1; counter < 100; counter += 1) {
    const tag = counter === 1 ? base : `${base}.${counter}`;
    if (!(await tagExists(tag))) return tag;
  }
  console.error(`could not find a free release tag for ${base}`);
  process.exit(1);
};

/** @type {{ publishedPackages?: Array<{ name: string, version: string }> }} */
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const published = summary.publishedPackages ?? [];

if (published.length === 0) {
  console.log("no packages were published, nothing to release");
  process.exit(0);
}

/** @type {Array<{ name: string, path: string }>} */
const workspace = JSON.parse(readFileSync(workspacePath, "utf8"));
const paths = new Map(workspace.map((entry) => [entry.name, entry.path]));

const releases = [...published].sort((a, b) => a.name.localeCompare(b.name));

let failed = false;

for (const { name, version } of releases) {
  if (!(await createTag(`${name}@${version}`))) failed = true;
}

const releaseTag = await nextReleaseTag();
const previousTag = await previousReleaseTag();

const out = [];

out.push("## Published packages");
out.push("");
out.push("| Package | Version |");
out.push("| :--- | ---: |");

for (const { name, version } of releases) {
  out.push(`| [\`${name}\`](https://www.npmjs.com/package/${name}) | \`${version}\` |`);
}

out.push("");
out.push("### Changelogs");
out.push("");

for (const { name, version } of releases) {
  const packagePath = paths.get(name);
  const entry = packagePath ? changelogEntry(packagePath, version) : "";
  out.push("<details>");
  out.push(`<summary><code>${name}@${version}</code></summary>`);
  out.push("");
  out.push("<br>");
  out.push("");
  out.push(entry || "_No changelog entry recorded._");
  out.push("");
  out.push("</details>");
  out.push("");
}

const notes = await generatedNotes(releaseTag, previousTag);
if (notes) {
  out.push("---");
  out.push("");
  out.push(notes);
}

// `target_commitish` makes GitHub create the tag when it does not exist yet.
const created = await api(`/repos/${repository}/releases`, "POST", {
  tag_name: releaseTag,
  target_commitish: sha,
  name: releaseTag,
  body: out.join("\n").trim(),
  draft: false,
  prerelease: releases.every(({ version }) => version.includes("-")),
});

if (created.ok) {
  console.log(`created release ${releaseTag}`);
} else {
  failed = true;
  console.error(`failed to create release ${releaseTag}:`, created.payload);
}

if (failed) process.exit(1);
