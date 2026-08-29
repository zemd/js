import { readFileSync, writeFileSync } from "node:fs";

import { parseWorkspacePackages } from "../pnpm.ts";
import {
  createReleasePlanArtifact,
  releasePlanWorkspace,
  validateReleasePlanArtifact,
} from "../release-plan.ts";
import type { Command } from "./command.ts";

const manifestVersion = (packagePath: string): string => {
  const manifest: unknown = JSON.parse(readFileSync(packagePath, "utf8"));
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error(`${packagePath}: expected a package manifest object`);
  }
  const version = (manifest as Record<string, unknown>)["version"];
  if (typeof version !== "string") {
    throw new Error(`${packagePath}: expected a string version field`);
  }
  return version;
};

export const releasePlan: Command = {
  usage:
    "create <workspace-list.json> <artifact-directory> [<contract-package.json>] | validate <artifact-directory> <workspace-output.json>",
  run: (argv) => {
    const [operation, firstPath, secondPath, thirdPath, ...unexpected] = argv;

    if (operation === "create" && firstPath && secondPath && unexpected.length === 0) {
      const workspace = parseWorkspacePackages(readFileSync(firstPath, "utf8"));
      createReleasePlanArtifact(secondPath, workspace, thirdPath ? manifestVersion(thirdPath) : "");
      return;
    }

    if (
      operation === "validate" &&
      firstPath &&
      secondPath &&
      thirdPath === undefined &&
      unexpected.length === 0
    ) {
      const plan = validateReleasePlanArtifact(firstPath);
      writeFileSync(secondPath, `${JSON.stringify(releasePlanWorkspace(plan))}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      process.stdout.write(`contract_version=${plan.contractVersion}\n`);
      return;
    }

    throw new Error(
      "usage: release-plan create <workspace-list.json> <artifact-directory> " +
        "[<contract-package.json>] | validate <artifact-directory> <workspace-output.json>",
    );
  },
};
