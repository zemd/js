import { readReleasePrArtifact } from "../release-pr-artifact.ts";
import { createSignedCommit } from "../signed-commit.ts";
import type { Command } from "./command.ts";
import { apiFromEnv } from "./context.ts";

// Publishes the current working-tree changes as a single signed commit on a
// branch via the GitHub GraphQL API.
export const signedCommit: Command = {
  usage: "<branch> <message> <base-oid> <artifact-directory>",
  run: async (argv) => {
    const [branch, message, baseOid, artifactDirectory] = argv;

    if (!branch || !message || !baseOid || !artifactDirectory) {
      throw new Error("usage: signed-commit <branch> <message> <base-oid> <artifact-directory>");
    }

    const artifact = readReleasePrArtifact(artifactDirectory);

    const oid = await createSignedCommit({
      api: apiFromEnv(),
      baseOid,
      branch,
      message,
      changes: artifact.changes,
    });

    console.log(`created signed commit ${oid}`);
  },
};
