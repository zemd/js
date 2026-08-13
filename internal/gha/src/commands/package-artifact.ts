import { readFileSync, writeFileSync } from "node:fs";

import {
  createPackageArtifact,
  parsePackageArtifactManifest,
  publishSummary,
  tarballForPackage,
  validatePackageArtifact,
  workspaceFromPackageArtifact,
} from "../package-artifact.ts";
import { parseWorkspacePackages } from "../pnpm.ts";
import type { Command } from "./command.ts";

const writeExclusiveJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
};

const packageNames = (path: string): string[] => {
  return readFileSync(path, "utf8").split("\n").filter(Boolean);
};

export const packageArtifact: Command = {
  usage: "<create|validate|tarball|summary> ...",
  run: (argv) => {
    const [operation, ...args] = argv;
    if (operation === "create") {
      const [workspacePath, directory] = args;
      if (!workspacePath || !directory) {
        throw new Error(
          "usage: package-artifact create <workspace-list.json> <artifact-directory>",
        );
      }
      createPackageArtifact({
        directory,
        workspace: parseWorkspacePackages(readFileSync(workspacePath, "utf8")),
      });
      return;
    }

    if (operation === "validate") {
      const [directory, manifestPath, workspacePath] = args;
      if (!directory || !manifestPath || !workspacePath) {
        throw new Error(
          "usage: package-artifact validate <artifact-directory> <manifest.json> <workspace-list.json>",
        );
      }
      const manifest = validatePackageArtifact({ directory });
      writeExclusiveJson(manifestPath, manifest);
      writeExclusiveJson(workspacePath, workspaceFromPackageArtifact(manifest));
      return;
    }

    if (operation === "tarball") {
      const [manifestPath, directory, packageName] = args;
      if (!manifestPath || !directory || !packageName) {
        throw new Error(
          "usage: package-artifact tarball <manifest.json> <artifact-directory> <package-name>",
        );
      }
      const manifest = parsePackageArtifactManifest(readFileSync(manifestPath, "utf8"));
      process.stdout.write(`${tarballForPackage(directory, manifest, packageName)}\n`);
      return;
    }

    if (operation === "summary") {
      const [manifestPath, packageNamesPath, outputPath] = args;
      if (!manifestPath || !packageNamesPath || !outputPath) {
        throw new Error(
          "usage: package-artifact summary <manifest.json> <package-names.txt> <summary.json>",
        );
      }
      const manifest = parsePackageArtifactManifest(readFileSync(manifestPath, "utf8"));
      writeExclusiveJson(outputPath, publishSummary(manifest, packageNames(packageNamesPath)));
      return;
    }

    throw new Error("usage: package-artifact <create|validate|tarball|summary> ...");
  },
};
