import type { Command } from "./command.ts";
import { contractVersion } from "./contract-version.ts";
import { githubReleases } from "./github-releases.ts";
import { npmPublishingMode } from "./npm-publishing-mode.ts";
import { packageArtifact } from "./package-artifact.ts";
import { releasePrArtifact } from "./release-pr-artifact.ts";
import { releasePrBody } from "./release-pr-body.ts";
import { releasePlan } from "./release-plan.ts";
import { sharedWorkflowsRelease } from "./shared-workflows-release.ts";
import { signedCommit } from "./signed-commit.ts";

export const commands: Readonly<Record<string, Command>> = {
  "contract-version": contractVersion,
  "github-releases": githubReleases,
  "npm-publishing-mode": npmPublishingMode,
  "package-artifact": packageArtifact,
  "release-pr-artifact": releasePrArtifact,
  "release-pr-body": releasePrBody,
  "release-plan": releasePlan,
  "shared-workflows-release": sharedWorkflowsRelease,
  "signed-commit": signedCommit,
};

export const usage = (): string =>
  [
    "usage: gha.mjs <command> [args]",
    "",
    ...Object.entries(commands).map(([name, command]) => `  ${name} ${command.usage}`),
  ].join("\n");
