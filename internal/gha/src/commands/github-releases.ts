import { readFileSync } from "node:fs";

import { requireEnv } from "../env";
import { releasePublishedPackages } from "../github-releases";
import { parsePublishSummary, parseWorkspacePackages } from "../pnpm";
import type { Command } from "./command";
import { apiFromEnv } from "./context";

// Tags the published commit once per package and publishes a single combined
// GitHub release for the run.
export const githubReleases: Command = {
  usage: "<publish-summary.json> <workspace-list.json>",
  run: async (argv) => {
    const [summaryPath, workspacePath] = argv;

    if (!summaryPath || !workspacePath) {
      throw new Error("usage: github-releases <publish-summary.json> <workspace-list.json>");
    }

    await releasePublishedPackages({
      api: apiFromEnv(),
      sha: requireEnv("GITHUB_SHA"),
      published: parsePublishSummary(readFileSync(summaryPath, "utf8")),
      workspace: parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
    });
  },
};
