import { readFileSync } from "node:fs";

import { requireEnv } from "../env";
import { releasePublishedPackages, type NpmReleaseState } from "../github-releases";
import { parsePublishSummary, parseWorkspacePackages } from "../pnpm";
import type { Command } from "./command";
import { apiFromEnv } from "./context";

// Tags the submitted commit once per package and publishes a single combined
// GitHub release for the run. The optional state keeps staged releases explicit.
export const githubReleases: Command = {
  usage: "<publish-summary.json> <workspace-list.json> [published|staged]",
  run: async (argv) => {
    const [summaryPath, workspacePath, rawState = "published"] = argv;

    if (!summaryPath || !workspacePath) {
      throw new Error(
        "usage: github-releases <publish-summary.json> <workspace-list.json> [published|staged]",
      );
    }
    if (rawState !== "published" && rawState !== "staged") {
      throw new Error(
        `github-releases: expected npm state "published" or "staged", got "${rawState}"`,
      );
    }
    const npmState: NpmReleaseState = rawState;

    await releasePublishedPackages({
      api: apiFromEnv(),
      sha: requireEnv("GITHUB_SHA"),
      published: parsePublishSummary(readFileSync(summaryPath, "utf8")),
      workspace: parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
      npmState,
    });
  },
};
