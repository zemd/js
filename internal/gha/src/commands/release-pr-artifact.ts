import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { parseWorkspacePackages } from "../pnpm.ts";
import { createReleasePrArtifact } from "../release-pr-artifact.ts";
import type { GitRunner } from "../signed-commit.ts";
import type { Command } from "./command.ts";

export const releasePrArtifact: Command = {
  usage: "<workspace-list.json> <pr-body.md> <artifact-directory>",
  run: (argv) => {
    const [workspacePath, prBodyPath, artifactDirectory] = argv;
    if (!workspacePath || !prBodyPath || !artifactDirectory) {
      throw new Error(
        "usage: release-pr-artifact <workspace-list.json> <pr-body.md> <artifact-directory>",
      );
    }

    const workspace = parseWorkspacePackages(readFileSync(workspacePath, "utf8"));
    const git: GitRunner = (args) => execFileSync("git", [...args], { encoding: "utf8" });
    createReleasePrArtifact({
      artifactDirectory,
      git,
      prBodyPath,
      workspacePaths: workspace.map(({ path }) => path),
    });
  },
};
