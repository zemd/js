import { readFileSync, writeFileSync } from "node:fs";

import { packageExistsOnRegistry, planNpmPublishing } from "../npm-publishing";
import { parseWorkspacePackages } from "../pnpm";
import type { Command } from "./command";

const parseBoolean = (value: string): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`npm-publishing-mode: expected "true" or "false", got "${value}"`);
};

// Staging cannot create a package, so a run containing any first release must
// use regular publishing. The command writes values ready for GITHUB_OUTPUT.
export const npmPublishingMode: Command = {
  usage:
    "<workspace-list.json> <registry-url> <staged-publishing> <first-releases.txt> <staged-packages.txt>",
  run: async (argv) => {
    const [workspacePath, registryUrl, rawStagedPublishing, firstReleasesPath, stagedPackagesPath] =
      argv;

    if (
      !workspacePath ||
      !registryUrl ||
      !rawStagedPublishing ||
      !firstReleasesPath ||
      !stagedPackagesPath
    ) {
      throw new Error(
        "usage: npm-publishing-mode <workspace-list.json> <registry-url> <staged-publishing> <first-releases.txt> <staged-packages.txt>",
      );
    }

    const plan = await planNpmPublishing(
      parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
      parseBoolean(rawStagedPublishing),
      (packageName) =>
        packageExistsOnRegistry(packageName, registryUrl, (url, init) =>
          fetch(url, { headers: init.headers }),
        ),
    );

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
      stagedPackagesPath,
      plan.stagedPackages.map((packageName) => `${packageName}\n`).join(""),
    );

    process.stdout.write(
      [
        `mode=${plan.mode}`,
        `direct=${rawStagedPublishing === "false" || plan.firstReleasePackages.length > 0}`,
        `direct_all=${rawStagedPublishing === "false"}`,
        `stage=${plan.stagedPackages.length > 0}`,
        `first_release=${plan.firstReleasePackages.length > 0}`,
        "",
      ].join("\n"),
    );
  },
};
