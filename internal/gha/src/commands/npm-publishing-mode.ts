import { readFileSync, writeFileSync } from "node:fs";

import { packageExistsOnRegistry, planNpmPublishing } from "../npm-publishing.ts";
import { parseWorkspacePackages } from "../pnpm.ts";
import { packageReleaseTag } from "../release-tags.ts";
import type { Command } from "./command.ts";
import { apiFromEnv } from "./context.ts";

const parseBoolean = (value: string): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`npm-publishing-mode: expected "true" or "false", got "${value}"`);
};

// Staging cannot create a package, so a run containing any first release must
// use regular publishing. The command writes values ready for GITHUB_OUTPUT.
export const npmPublishingMode: Command = {
  usage:
    "<workspace-list.json> <registry-url> <staged-publishing> <first-releases.txt> <direct-packages.txt> <staged-packages.txt>",
  run: async (argv) => {
    const [
      workspacePath,
      registryUrl,
      rawStagedPublishing,
      firstReleasesPath,
      directPackagesPath,
      stagedPackagesPath,
    ] = argv;

    if (
      !workspacePath ||
      !registryUrl ||
      !rawStagedPublishing ||
      !firstReleasesPath ||
      !directPackagesPath ||
      !stagedPackagesPath
    ) {
      throw new Error(
        "usage: npm-publishing-mode <workspace-list.json> <registry-url> <staged-publishing> <first-releases.txt> <direct-packages.txt> <staged-packages.txt>",
      );
    }

    const stagedPublishing = parseBoolean(rawStagedPublishing);
    const api = apiFromEnv();
    const plan = await planNpmPublishing(
      parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
      stagedPublishing,
      (packageName) =>
        packageExistsOnRegistry(packageName, registryUrl, (url, init) =>
          fetch(url, { headers: init.headers }),
        ),
      (tag) => api.tagExists(tag),
    );

    if (plan.previouslySubmittedPackages.length > 0) {
      console.error(
        `Skipping versions already recorded by immutable release tags: ${plan.previouslySubmittedPackages
          .map(({ name, version }) => packageReleaseTag(name, version))
          .join(", ")}`,
      );
    }

    if (plan.firstReleasePackages.length > 0) {
      console.error(
        `Regular npm publishing is required for first release: ${plan.firstReleasePackages.join(
          ", ",
        )}`,
      );
    }

    writeFileSync(
      firstReleasesPath,
      plan.firstReleasePackages.map((packageName) => `${packageName}\n`).join(""),
    );
    writeFileSync(
      directPackagesPath,
      plan.directPackages.map((packageName) => `${packageName}\n`).join(""),
    );
    writeFileSync(
      stagedPackagesPath,
      plan.stagedPackages.map((packageName) => `${packageName}\n`).join(""),
    );

    process.stdout.write(
      [
        `mode=${plan.mode}`,
        `direct=${plan.directPackages.length > 0}`,
        `stage=${plan.stagedPackages.length > 0}`,
        `first_release=${plan.firstReleasePackages.length > 0}`,
        "",
      ].join("\n"),
    );
  },
};
