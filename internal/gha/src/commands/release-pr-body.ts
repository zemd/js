import { readFileSync } from "node:fs";

import { parseAppliedReleases, parseWorkspacePackages } from "../pnpm";
import { renderReleasePrBody } from "../release-pr-body";
import type { Command } from "./command";

// Renders the body of the automated release pull request from the releases
// applied by `pnpm version -r --json` and the current workspace package list.
export const releasePrBody: Command = {
  usage: "<releases.json> <workspace-list.json>",
  run: (argv) => {
    const [releasesPath, workspacePath] = argv;

    if (!releasesPath || !workspacePath) {
      throw new Error("usage: release-pr-body <releases.json> <workspace-list.json>");
    }

    process.stdout.write(
      renderReleasePrBody(
        parseAppliedReleases(readFileSync(releasesPath, "utf8")),
        parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
      ),
    );
  },
};
