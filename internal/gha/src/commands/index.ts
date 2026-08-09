import type { Command } from "./command";
import { contractVersion } from "./contract-version";
import { githubReleases } from "./github-releases";
import { npmPublishingMode } from "./npm-publishing-mode";
import { releasePrBody } from "./release-pr-body";
import { sharedWorkflowsRelease } from "./shared-workflows-release";
import { signedCommit } from "./signed-commit";

export const commands: Readonly<Record<string, Command>> = {
  "contract-version": contractVersion,
  "github-releases": githubReleases,
  "npm-publishing-mode": npmPublishingMode,
  "release-pr-body": releasePrBody,
  "shared-workflows-release": sharedWorkflowsRelease,
  "signed-commit": signedCommit,
};

export const usage = (): string =>
  [
    "usage: gha.mjs <command> [args]",
    "",
    ...Object.entries(commands).map(([name, command]) => `  ${name} ${command.usage}`),
  ].join("\n");
