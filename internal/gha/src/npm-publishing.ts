import type { PublishedPackage, WorkspacePackage } from "./pnpm";
import { packageReleaseTag } from "./release-tags";

export type NpmPublishingMode = "direct" | "mixed" | "none" | "staged";

export interface NpmPublishingPlan {
  readonly mode: NpmPublishingMode;
  readonly directPackages: readonly string[];
  readonly firstReleasePackages: readonly string[];
  readonly previouslySubmittedPackages: readonly PublishedPackage[];
  readonly stagedPackages: readonly string[];
}

interface RegistryResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
}

export type RegistryRequest = (
  url: URL,
  init: { readonly headers: Readonly<Record<string, string>> },
) => Promise<RegistryResponse>;

const packageUrl = (registryUrl: string, packageName: string): URL => {
  const registry = new URL(registryUrl);
  if (!registry.pathname.endsWith("/")) registry.pathname += "/";
  const encodedName = encodeURIComponent(packageName).replace(/^%40/, "@");

  return new URL(encodedName, registry);
};

export const packageExistsOnRegistry = async (
  packageName: string,
  registryUrl: string,
  request: RegistryRequest,
): Promise<boolean> => {
  const response = await request(packageUrl(registryUrl, packageName), {
    headers: { accept: "application/vnd.npm.install-v1+json" },
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    const status = response.statusText
      ? `${response.status} ${response.statusText}`
      : String(response.status);
    throw new Error(`npm registry lookup for "${packageName}" failed: ${status}`);
  }

  return true;
};

export const planNpmPublishing = async (
  workspace: readonly WorkspacePackage[],
  stagedPublishing: boolean,
  packageExists: (packageName: string) => Promise<boolean>,
  releaseTagExists: (tag: string) => Promise<boolean>,
): Promise<NpmPublishingPlan> => {
  const publicPackages = workspace.filter((workspacePackage) => !workspacePackage.private);
  const submissionState = await Promise.all(
    publicPackages.map(async (workspacePackage) => ({
      workspacePackage,
      submitted: await releaseTagExists(
        packageReleaseTag(workspacePackage.name, workspacePackage.version),
      ),
    })),
  );
  const previouslySubmittedPackages = submissionState
    .filter(({ submitted }) => submitted)
    .map(({ workspacePackage: { name, version } }) => ({ name, version }));
  const pendingPackages = submissionState
    .filter(({ submitted }) => !submitted)
    .map(({ workspacePackage }) => workspacePackage);
  const existence = await Promise.all(
    pendingPackages.map(async (workspacePackage) => ({
      name: workspacePackage.name,
      exists: await packageExists(workspacePackage.name),
    })),
  );
  const firstReleasePackages = existence.filter(({ exists }) => !exists).map(({ name }) => name);
  const directPackages = stagedPublishing
    ? firstReleasePackages
    : existence.map(({ name }) => name);
  const stagedPackages = stagedPublishing
    ? existence.filter(({ exists }) => exists).map(({ name }) => name)
    : [];

  let mode: NpmPublishingMode;
  if (directPackages.length > 0) {
    mode = stagedPackages.length > 0 ? "mixed" : "direct";
  } else if (stagedPackages.length > 0) {
    mode = "staged";
  } else {
    mode = "none";
  }

  return {
    mode,
    directPackages,
    firstReleasePackages,
    previouslySubmittedPackages,
    stagedPackages,
  };
};
