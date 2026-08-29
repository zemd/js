import { changelogEntry } from "./changelog.ts";
import type { GitHubApi } from "./github.ts";
import { isReleaseVersion } from "./semver.ts";

export interface SharedReleaseBody {
  readonly repository: string;
  readonly version: string;
  readonly sha: string;
  readonly workflows: readonly string[];
  readonly changelog?: string;
  readonly notes?: string;
}

export const renderSharedReleaseBody = ({
  repository,
  version,
  sha,
  workflows,
  changelog,
  notes,
}: SharedReleaseBody): string => {
  const major = version.split(".")[0];
  const out: string[] = [];

  out.push("Shared GitHub Actions workflows. Add one job per workflow to a caller in");
  out.push("`.github/workflows/`, pinned to this commit:");
  out.push("");
  out.push("```yaml");
  for (const workflow of workflows) {
    out.push(`uses: ${repository}/.github/workflows/${workflow}@${sha} # v${version}`);
  }
  out.push("```");
  out.push("");
  out.push(
    `Ready-to-copy callers: [\`.github/workflows-examples\`](https://github.com/${repository}/tree/${sha}/.github/workflows-examples).`,
  );
  out.push("");
  out.push("Re-resolve this commit at any time:");
  out.push("");
  out.push("```sh");
  out.push(`gh api repos/${repository}/git/ref/tags/v${major} --jq .object.sha`);
  out.push("```");

  if (changelog?.trim()) {
    out.push("");
    out.push("## Changes");
    out.push("");
    out.push(changelog.trim());
  }

  if (notes?.trim()) {
    out.push("");
    out.push("---");
    out.push("");
    out.push(notes.trim());
  }

  return `${out.join("\n")}\n`;
};

export interface SharedReleaseInput {
  readonly api: GitHubApi;
  readonly sha: string;
  readonly version: string;
  readonly packagePath: string;
  readonly workflows: readonly string[];
}

export const sharedWorkflowReleasePending = async (
  api: Pick<GitHubApi, "releaseExists">,
  version: string,
): Promise<boolean> => {
  if (!isReleaseVersion(version)) {
    throw new Error(`expected a plain semver version, got "${version}"`);
  }

  return !(await api.releaseExists(`v${version}`));
};

const putTag = async (
  api: GitHubApi,
  tag: string,
  sha: string,
  force: boolean,
): Promise<boolean> => {
  const created = await api.createRef(`refs/tags/${tag}`, sha);
  if (created.ok) return true;

  if (!force) {
    console.error(`failed to create tag ${tag}:`, created.payload);
    return false;
  }

  const updated = await api.updateRef(`refs/tags/${tag}`, sha);
  if (updated.ok) return true;

  console.error(`failed to move tag ${tag}:`, updated.payload);
  return false;
};

// Publishes the workflow contract itself: an immutable `vX.Y.Z` tag, a moving
// `vX` tag, and a release whose body carries `uses:` lines already pinned to
// this commit so consumers can copy them.
export const releaseSharedWorkflows = async ({
  api,
  sha,
  version,
  packagePath,
  workflows,
}: SharedReleaseInput): Promise<void> => {
  if (!isReleaseVersion(version)) {
    throw new Error(`expected a plain semver version, got "${version}"`);
  }
  if (workflows.length === 0) {
    throw new Error("no shared-*.yml workflows found");
  }

  const tag = `v${version}`;

  if (!(await sharedWorkflowReleasePending(api, version))) {
    console.log(`${tag} already released, nothing to do`);
    return;
  }

  const releases = await api.listReleases();

  if (!(await api.tagExists(tag)) && !(await putTag(api, tag, sha, false))) {
    throw new Error(`could not create ${tag}`);
  }
  if (!(await putTag(api, `v${version.split(".")[0]}`, sha, true))) {
    throw new Error(`could not move the major tag for ${tag}`);
  }

  const previousTag =
    releases
      .filter((release) => isReleaseVersion(release.tag_name.replace(/^v/, "")))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.tag_name ?? "";

  const created = await api.createRelease({
    tag,
    name: `Shared workflows ${tag}`,
    body: renderSharedReleaseBody({
      repository: api.repository,
      version,
      sha,
      workflows,
      changelog: changelogEntry(packagePath, version),
      notes: await api.generateNotes(tag, sha, previousTag),
    }),
    prerelease: false,
  });

  if (!created.ok) {
    throw new Error(`failed to create release ${tag}: ${JSON.stringify(created.payload)}`);
  }

  console.log(`created release ${tag} at ${sha}`);
};
