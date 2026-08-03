#!/usr/bin/env node
// Publishes the current working-tree changes as a single commit on a branch via
// the GitHub GraphQL API. Commits created through the API are signed with
// GitHub's own key, so they show up as "Verified" instead of unsigned.
//
// Usage: node .github/scripts/signed-commit.mjs <branch> <message>
// Requires GITHUB_TOKEN (contents: write) and GITHUB_REPOSITORY.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [branch, message] = process.argv.slice(2);

if (!branch || !message) {
  console.error("usage: signed-commit.mjs <branch> <message>");
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";

if (!token || !repository) {
  console.error("GITHUB_TOKEN and GITHUB_REPOSITORY must be set");
  process.exit(1);
}

/**
 * @param {string} path
 * @param {"GET" | "POST" | "PATCH"} method
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
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return { ok: response.ok, status: response.status, payload };
};

/** @param {string[]} args */
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

// `-z` records are NUL separated; a rename record is followed by an extra
// record holding the original path.
const collectChanges = () => {
  const raw = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    encoding: "utf8",
  });
  const records = raw.split("\0").filter(Boolean);

  /** @type {Set<string>} */
  const added = new Set();
  /** @type {Set<string>} */
  const deleted = new Set();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] ?? "";
    const state = record.slice(0, 2);
    const path = record.slice(3);

    if (state[0] === "R" || state[0] === "C") {
      const origin = records[index + 1];
      index += 1;
      if (state[0] === "R" && origin) deleted.add(origin);
      added.add(path);
      continue;
    }

    if (state.includes("D")) {
      deleted.add(path);
      continue;
    }

    added.add(path);
  }

  return {
    additions: [...added].map((path) => ({
      path,
      contents: readFileSync(path).toString("base64"),
    })),
    deletions: [...deleted].map((path) => ({ path })),
  };
};

const fileChanges = collectChanges();

if (fileChanges.additions.length === 0 && fileChanges.deletions.length === 0) {
  console.error("nothing to commit");
  process.exit(1);
}

// The API commit is built on top of the checked-out commit, so the remote
// branch has to be reset to that same commit first.
const baseOid = git(["rev-parse", "HEAD"]);
const ref = `refs/heads/${branch}`;

const created = await api(`/repos/${repository}/git/refs`, "POST", { ref, sha: baseOid });
if (!created.ok) {
  const updated = await api(`/repos/${repository}/git/${ref}`, "PATCH", {
    sha: baseOid,
    force: true,
  });
  if (!updated.ok) {
    console.error(`failed to point ${branch} at ${baseOid}:`, updated.payload);
    process.exit(1);
  }
}

const [headline, ...body] = message.split("\n\n");

const result = await api("/graphql", "POST", {
  query: `
    mutation ($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
        }
      }
    }
  `,
  variables: {
    input: {
      branch: { repositoryNameWithOwner: repository, branchName: branch },
      expectedHeadOid: baseOid,
      message: { headline, body: body.join("\n\n") || undefined },
      fileChanges,
    },
  },
});

if (!result.ok || result.payload.errors) {
  console.error("failed to create commit:", result.payload.errors ?? result.payload);
  process.exit(1);
}

console.log(`created signed commit ${result.payload.data.createCommitOnBranch.commit.oid}`);
