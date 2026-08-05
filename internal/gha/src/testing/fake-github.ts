import type { GitHubApi, NewRelease, ReleaseSummary } from "../github";

export interface FakeGitHubOptions {
  readonly repository?: string;
  readonly existingTags?: readonly string[];
  readonly releases?: readonly ReleaseSummary[];
  readonly notes?: string;
  /** Refs the API rejects with 422, as GitHub does for an existing ref. */
  readonly refusedRefs?: readonly string[];
  readonly refuseReleaseCreation?: boolean;
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
  const createdRefs: Array<{ ref: string; sha: string }> = [];
  const updatedRefs: Array<{ ref: string; sha: string }> = [];
  const createdReleases: NewRelease[] = [];

  const api: GitHubApi = {
    repository: options.repository ?? "acme/repo",
    request: unsupported,
    graphql: unsupported,

    tagExists: (tag) => Promise.resolve(tags.has(tag)),

    createRef: (ref, sha) => {
      if (refused.has(ref)) {
        return Promise.resolve({ ok: false, status: 422, payload: { message: "already exists" } });
      }
      createdRefs.push({ ref, sha });
      tags.add(ref.replace("refs/tags/", ""));
      return Promise.resolve({ ok: true, status: 201, payload: {} });
    },

    updateRef: (ref, sha) => {
      updatedRefs.push({ ref, sha });
      return Promise.resolve({ ok: true, status: 200, payload: {} });
    },

    listReleases: () => Promise.resolve(options.releases ?? []),

    generateNotes: () => Promise.resolve(options.notes ?? ""),

    createRelease: (release) => {
      if (options.refuseReleaseCreation) {
        return Promise.resolve({ ok: false, status: 500, payload: { message: "boom" } });
      }
      createdReleases.push(release);
      return Promise.resolve({ ok: true, status: 201, payload: {} });
    },

    createCommitOnBranch: () => Promise.resolve("commit-oid"),
  };

  return { api, tags, createdRefs, updatedRefs, createdReleases };
};
