import { existsSync, readFileSync } from "node:fs";

import { requireEnv } from "../env";
import { releasePublishedPackages } from "../github-releases";
import { parsePublishSummary, parseWorkspacePackages } from "../pnpm";
import type { Command } from "./command";
import { apiFromEnv } from "./context";

const readSummary = (path: string) =>
  existsSync(path) ? parsePublishSummary(readFileSync(path, "utf8")) : [];

// Tags the submitted commit once per package and publishes a single combined
// GitHub release that distinguishes published and staged versions.
export const githubReleases: Command = {
  usage: "<published-summary.json> <staged-summary.json> <workspace-list.json>",
  run: async (argv) => {
    const [publishedSummaryPath, stagedSummaryPath, workspacePath] = argv;

    if (!publishedSummaryPath || !stagedSummaryPath || !workspacePath) {
      throw new Error(
        "usage: github-releases <published-summary.json> <staged-summary.json> <workspace-list.json>",
      );
    }

    await releasePublishedPackages({
      api: apiFromEnv(),
      sha: requireEnv("GITHUB_SHA"),
      published: readSummary(publishedSummaryPath),
      staged: readSummary(stagedSummaryPath),
      workspace: parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
    });
  },
};
