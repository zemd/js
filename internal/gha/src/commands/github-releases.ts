import { existsSync, readFileSync } from "node:fs";

import { requireEnv } from "../env.ts";
import { releasePublishedPackages } from "../github-releases.ts";
import { parsePackageArtifactManifest } from "../package-artifact.ts";
import { parsePublishSummary } from "../pnpm.ts";
import type { Command } from "./command.ts";
import { apiFromEnv } from "./context.ts";

const readSummary = (path: string) =>
  existsSync(path) ? parsePublishSummary(readFileSync(path, "utf8")) : [];

// Tags the submitted commit once per package and publishes a single combined
// GitHub release that distinguishes published and staged versions.
export const githubReleases: Command = {
  usage: "<published-summary.json> <staged-summary.json> <release-manifest.json>",
  run: async (argv) => {
    const [publishedSummaryPath, stagedSummaryPath, manifestPath] = argv;

    if (!publishedSummaryPath || !stagedSummaryPath || !manifestPath) {
      throw new Error(
        "usage: github-releases <published-summary.json> <staged-summary.json> <release-manifest.json>",
      );
    }

    await releasePublishedPackages({
      api: apiFromEnv(),
      sha: requireEnv("GITHUB_SHA"),
      published: readSummary(publishedSummaryPath),
      staged: readSummary(stagedSummaryPath),
      manifest: parsePackageArtifactManifest(readFileSync(manifestPath, "utf8")),
    });
  },
};
