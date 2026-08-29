import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { requireEnv } from "../env.ts";
import { releaseSharedWorkflows, sharedWorkflowReleasePending } from "../shared-workflows.ts";
import type { Command } from "./command.ts";
import { apiFromEnv } from "./context.ts";

const manifestVersion = (packagePath: string): string => {
  const manifest: unknown = JSON.parse(readFileSync(packagePath, "utf8"));

  if (typeof manifest !== "object" || manifest === null || !("version" in manifest)) {
    throw new Error(`${packagePath} has no version field`);
  }

  const { version } = manifest as { version: unknown };

  if (typeof version !== "string") {
    throw new Error(`${packagePath}: expected a string version, got ${JSON.stringify(version)}`);
  }

  return version;
};

// Publishes the shared workflow contract: a `vX.Y.Z` tag, a moving `vX` tag and
// a GitHub release whose body carries `uses:` lines already pinned to this
// commit. The version is @zemd/gha's, which is what the workflows execute.
export const sharedWorkflowsRelease: Command = {
  usage: "<package.json> <workflows-dir> | pending <version>",
  run: async (argv) => {
    if (argv[0] === "pending") {
      const [, version, ...unexpected] = argv;
      if (!version || unexpected.length > 0) {
        throw new Error("usage: shared-workflows-release pending <version>");
      }

      const pending = await sharedWorkflowReleasePending(apiFromEnv(), version);
      process.stdout.write(`pending=${pending}\n`);
      return;
    }

    const [packagePath, workflowsDir] = argv;

    if (!packagePath || !workflowsDir) {
      throw new Error("usage: shared-workflows-release <package.json> <workflows-dir>");
    }

    await releaseSharedWorkflows({
      api: apiFromEnv(),
      sha: requireEnv("GITHUB_SHA"),
      version: manifestVersion(packagePath),
      packagePath: dirname(packagePath),
      workflows: readdirSync(workflowsDir)
        .filter((file) => file.startsWith("shared-") && file.endsWith(".yml"))
        .sort(),
    });
  },
};
