import { execFileSync } from "node:child_process";

import { collectChanges, createSignedCommit, type GitRunner } from "../signed-commit.ts";
import type { Command } from "./command.ts";
import { apiFromEnv } from "./context.ts";

// Publishes the current working-tree changes as a single signed commit on a
// branch via the GitHub GraphQL API.
export const signedCommit: Command = {
  usage: "<branch> <message>",
  run: async (argv) => {
    const [branch, message] = argv;

    if (!branch || !message) {
      throw new Error("usage: signed-commit <branch> <message>");
    }

    const git: GitRunner = (args) => execFileSync("git", [...args], { encoding: "utf8" });

    const oid = await createSignedCommit({
      api: apiFromEnv(),
      git,
      branch,
      message,
      changes: collectChanges({ git }),
    });

    console.log(`created signed commit ${oid}`);
  },
};
