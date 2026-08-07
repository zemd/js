import type { GitHubApi, NewRelease, ReleaseSummary } from "../github";

export interface FakeGitHubOptions {
  readonly repository?: string;
  readonly existingTags?: readonly string[];
  readonly releases?: readonly ReleaseSummary[];
  readonly notes?: string;
  /** Refs the API rejects with 422, as GitHub does for an existing ref. */
  readonly refusedRefs?: readonly string[];
  /** Number of times an update for each ref fails before succeeding. */
  readonly updateRefFailures?: Readonly<Record<string, number>>;
  readonly refuseReleaseCreation?: boolean;
  /** Number of release creations that fail before succeeding. */
  readonly releaseCreationFailures?: number;
}

export interface FakeGitHub {
  readonly api: GitHubApi;
  readonly tags: Set<string>;
  readonly createdRefs: Array<{ ref: string; sha: string }>;
  readonly updatedRefs: Array<{ ref: string; sha: string }>;
  readonly createdReleases: NewRelease[];
}

const unsupported = (): never => {
  throw new Error("not used by the code under test");
};

export const fakeGitHub = (options: FakeGitHubOptions = {}): FakeGitHub => {
  const tags = new Set(options.existingTags ?? []);
  const refused = new Set(options.refusedRefs ?? []);
  const updateRefFailures = new Map(Object.entries(options.updateRefFailures ?? {}));
  let releaseCreationFailures = options.releaseCreationFailures ?? 0;
  const releases = [...(options.releases ?? [])];
  const createdRefs: Array<{ ref: string; sha: string }> = [];
  const updatedRefs: Array<{ ref: string; sha: string }> = [];
  const createdReleases: NewRelease[] = [];

  const api: GitHubApi = {
    repository: options.repository ?? "acme/repo",
    request: unsupported,
    graphql: unsupported,

    tagExists: (tag) => Promise.resolve(tags.has(tag)),

    createRef: (ref, sha) => {
      const tag = ref.replace(/^refs\/tags\//, "");
      if (refused.has(ref) || (ref.startsWith("refs/tags/") && tags.has(tag))) {
        return Promise.resolve({ ok: false, status: 422, payload: { message: "already exists" } });
      }
      createdRefs.push({ ref, sha });
      if (ref.startsWith("refs/tags/")) tags.add(tag);
      return Promise.resolve({ ok: true, status: 201, payload: {} });
    },

    updateRef: (ref, sha) => {
      const failures = updateRefFailures.get(ref) ?? 0;
      if (failures > 0) {
        updateRefFailures.set(ref, failures - 1);
        return Promise.resolve({ ok: false, status: 500, payload: { message: "boom" } });
      }
      updatedRefs.push({ ref, sha });
      return Promise.resolve({ ok: true, status: 200, payload: {} });
    },

    listReleases: () => Promise.resolve(releases),

    generateNotes: () => Promise.resolve(options.notes ?? ""),

    createRelease: (release) => {
      if (options.refuseReleaseCreation || releaseCreationFailures > 0) {
        releaseCreationFailures -= 1;
        return Promise.resolve({ ok: false, status: 500, payload: { message: "boom" } });
      }
      createdReleases.push(release);
      releases.push({ tag_name: release.tag, created_at: new Date().toISOString() });
      return Promise.resolve({ ok: true, status: 201, payload: {} });
    },

    createCommitOnBranch: () => Promise.resolve("commit-oid"),
  };

  return { api, tags, createdRefs, updatedRefs, createdReleases };
};
