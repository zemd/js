import { changelogEntry } from "./changelog";
import type { GitHubApi } from "./github";
import type { PublishedPackage, WorkspacePackage } from "./pnpm";
import { packageReleaseTag } from "./release-tags";

const RELEASE_TAG_PREFIX = "release-";

export interface CombinedRelease {
  readonly published: readonly PublishedPackage[];
  readonly staged?: readonly PublishedPackage[];
  readonly paths: ReadonlyMap<string, string>;
  readonly notes?: string;
}

const appendPackageTable = (
  out: string[],
  heading: string,
  packages: readonly PublishedPackage[],
  approvalRequired: boolean,
): void => {
  if (packages.length === 0) return;

  out.push(`## ${heading}`);
  if (approvalRequired) {
    out.push("");
    out.push(
      "These versions require maintainer approval with 2FA before they become available from npm.",
    );
    out.push(
      "Rejecting one does not roll back this release or make its version reusable; release changes under a new version instead.",
    );
  }
  out.push("");
  out.push("| Package | Version |");
  out.push("| :--- | ---: |");

  for (const { name, version } of packages) {
    out.push(`| [\`${name}\`](https://www.npmjs.com/package/${name}) | \`${version}\` |`);
  }
  out.push("");
};

export const renderCombinedReleaseBody = ({
  published,
  staged = [],
  paths,
  notes,
}: CombinedRelease): string => {
  const out: string[] = [];
  const submitted = [...published, ...staged];

  appendPackageTable(out, "Published packages", published, false);
  appendPackageTable(out, "Packages staged on npm", staged, true);
  out.push("### Changelogs");
  out.push("");

  for (const { name, version } of submitted) {
    const packagePath = paths.get(name);
    out.push("<details>");
    out.push(`<summary><code>${name}@${version}</code></summary>`);
    out.push("");
    out.push("<br>");
    out.push("");
    out.push(
      (packagePath ? changelogEntry(packagePath, version) : "") || "_No changelog entry recorded._",
    );
    out.push("");
    out.push("</details>");
    out.push("");
  }

  if (notes?.trim()) {
    out.push("---");
    out.push("");
    out.push(notes.trim());
  }

  return out.join("\n").trim();
};

// `release-YYYY-MM-DD-HHmm`, suffixed with `.2`, `.3`, ... when that tag is
// taken (git tags cannot contain `:`, hence the compact time).
export const nextReleaseTag = async (api: GitHubApi, now: Date): Promise<string> => {
  const stamp = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const base = `${RELEASE_TAG_PREFIX}${stamp}`;

  for (let counter = 1; counter < 100; counter += 1) {
    const tag = counter === 1 ? base : `${base}.${counter}`;
    if (!(await api.tagExists(tag))) return tag;
  }

  throw new Error(`could not find a free release tag for ${base}`);
};

// Tag of the previous combined release, so the generated notes cover exactly
// the commits released since then.
export const previousReleaseTag = async (api: GitHubApi): Promise<string> => {
  const releases = await api.listReleases();
  return (
    releases
      .filter((release) => release.tag_name.startsWith(RELEASE_TAG_PREFIX))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.tag_name ?? ""
  );
};

const createTag = async (api: GitHubApi, tag: string, sha: string): Promise<boolean> => {
  const response = await api.createRef(`refs/tags/${tag}`, sha);
  if (response.ok) {
    console.log(`created tag ${tag}`);
    return true;
  }
  if (response.status === 422 && (await api.tagExists(tag))) {
    console.log(`tag ${tag} already exists, skipping`);
    return true;
  }
  console.error(`failed to create tag ${tag}:`, response.payload);
  return false;
};

export interface PackageReleaseInput {
  readonly api: GitHubApi;
  readonly sha: string;
  readonly published: readonly PublishedPackage[];
  readonly staged?: readonly PublishedPackage[];
  readonly workspace: readonly WorkspacePackage[];
  readonly now?: Date;
}

// Submission consumes a package version whether npm approval follows or not.
// These tags are therefore created for both direct and staged submissions; the
// publishing planner uses them to prevent a rejected version from being reused.
export const releasePublishedPackages = async ({
  api,
  sha,
  published,
  staged = [],
  workspace,
  now = new Date(),
}: PackageReleaseInput): Promise<void> => {
  if (published.length === 0 && staged.length === 0) {
    console.log("no packages were submitted to npm, nothing to release");
    return;
  }

  const publishedReleases = [...published].sort((a, b) => a.name.localeCompare(b.name));
  const stagedReleases = [...staged].sort((a, b) => a.name.localeCompare(b.name));
  const releases = [...publishedReleases, ...stagedReleases].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const paths = new Map(workspace.map((entry) => [entry.name, entry.path]));

  let failed = false;

  for (const { name, version } of releases) {
    if (!(await createTag(api, packageReleaseTag(name, version), sha))) failed = true;
  }

  const releaseTag = await nextReleaseTag(api, now);
  const notes = await api.generateNotes(releaseTag, sha, await previousReleaseTag(api));

  // `targetCommitish` makes GitHub create the tag when it does not exist yet.
  const created = await api.createRelease({
    tag: releaseTag,
    name: releaseTag,
    targetCommitish: sha,
    body: renderCombinedReleaseBody({
      published: publishedReleases,
      staged: stagedReleases,
      paths,
      notes,
    }),
    prerelease: releases.every(({ version }) => version.includes("-")),
  });

  if (created.ok) {
    console.log(`created release ${releaseTag}`);
  } else {
    failed = true;
    console.error(`failed to create release ${releaseTag}:`, created.payload);
  }

  if (failed) throw new Error("one or more release steps failed");
};
