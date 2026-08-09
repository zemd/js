export type HttpMethod = "GET" | "POST" | "PATCH";

export interface GitHubResponse<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly payload: T;
}

export interface ReleaseSummary {
  readonly tag_name: string;
  readonly created_at: string;
}

export interface NewRelease {
  readonly tag: string;
  readonly name: string;
  readonly body: string;
  readonly targetCommitish?: string;
  readonly prerelease: boolean;
}

export interface FileChanges {
  readonly additions: ReadonlyArray<{ readonly path: string; readonly contents: string }>;
  readonly deletions: ReadonlyArray<{ readonly path: string }>;
}

export interface GitHubApi {
  readonly repository: string;
  request<T>(path: string, method: HttpMethod, body?: unknown): Promise<GitHubResponse<T>>;
  graphql<T>(query: string, variables: unknown): Promise<GitHubResponse<T>>;
  tagExists(tag: string): Promise<boolean>;
  createRef(ref: string, sha: string): Promise<GitHubResponse<unknown>>;
  updateRef(ref: string, sha: string): Promise<GitHubResponse<unknown>>;
  listReleases(): Promise<readonly ReleaseSummary[]>;
  generateNotes(tag: string, sha: string, previousTag: string): Promise<string>;
  createRelease(release: NewRelease): Promise<GitHubResponse<unknown>>;
  createCommitOnBranch(
    branch: string,
    expectedHeadOid: string,
    message: string,
    fileChanges: FileChanges,
  ): Promise<string>;
}

export interface GitHubApiOptions {
  readonly token: string;
  readonly repository: string;
  readonly apiUrl?: string;
  readonly graphqlUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

const COMMIT_MUTATION = `
    mutation ($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
        }
      }
    }
  `;

export const createGitHubApi = (options: GitHubApiOptions): GitHubApi => {
  const { token, repository } = options;
  const apiUrl = options.apiUrl ?? "https://api.github.com";
  const graphqlUrl = options.graphqlUrl ?? "https://api.github.com/graphql";
  const doFetch = options.fetch ?? globalThis.fetch;

  const requestUrl = async <T>(
    url: string,
    method: HttpMethod,
    body?: unknown,
  ): Promise<GitHubResponse<T>> => {
    const response = await doFetch(url, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      payload: (text ? JSON.parse(text) : {}) as T,
    };
  };

  const request = <T>(
    path: string,
    method: HttpMethod,
    body?: unknown,
  ): Promise<GitHubResponse<T>> => requestUrl(`${apiUrl}${path}`, method, body);

  const api: GitHubApi = {
    repository,
    request,

    graphql: (query, variables) => requestUrl(graphqlUrl, "POST", { query, variables }),

    tagExists: async (tag) => {
      const response = await request(
        `/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`,
        "GET",
      );
      if (response.status === 404) return false;
      if (!response.ok) {
        throw new Error(`failed to check git tag "${tag}": GitHub returned ${response.status}`);
      }
      return true;
    },

    createRef: (ref, sha) => request(`/repos/${repository}/git/refs`, "POST", { ref, sha }),

    updateRef: (ref, sha) =>
      request(`/repos/${repository}/git/${ref}`, "PATCH", { sha, force: true }),

    listReleases: async () => {
      const response = await request<readonly ReleaseSummary[]>(
        `/repos/${repository}/releases?per_page=100`,
        "GET",
      );
      return response.ok ? response.payload : [];
    },

    // The same notes GitHub renders behind "Generate release notes" in the UI.
    generateNotes: async (tag, sha, previousTag) => {
      const response = await request<{ body?: string }>(
        `/repos/${repository}/releases/generate-notes`,
        "POST",
        {
          tag_name: tag,
          target_commitish: sha,
          ...(previousTag ? { previous_tag_name: previousTag } : {}),
        },
      );
      if (!response.ok) {
        console.warn(`failed to generate notes for ${tag}:`, response.payload);
        return "";
      }
      return (response.payload.body ?? "").trim();
    },

    createRelease: (release) =>
      request(`/repos/${repository}/releases`, "POST", {
        tag_name: release.tag,
        name: release.name,
        body: release.body,
        draft: false,
        prerelease: release.prerelease,
        ...(release.targetCommitish === undefined
          ? {}
          : { target_commitish: release.targetCommitish }),
      }),

    // Commits created through the API are signed with GitHub's own key, so they
    // show up as "Verified" instead of unsigned.
    createCommitOnBranch: async (branch, expectedHeadOid, message, fileChanges) => {
      const [headline, ...body] = message.split("\n\n");
      const rest = body.join("\n\n");

      const result = await api.graphql<{
        data?: { createCommitOnBranch: { commit: { oid: string } } };
        errors?: unknown;
      }>(COMMIT_MUTATION, {
        input: {
          branch: { repositoryNameWithOwner: repository, branchName: branch },
          expectedHeadOid,
          message: { headline, ...(rest ? { body: rest } : {}) },
          fileChanges,
        },
      });

      const oid = result.payload.data?.createCommitOnBranch.commit.oid;
      if (!result.ok || result.payload.errors || !oid) {
        throw new Error(
          `failed to create commit: ${JSON.stringify(result.payload.errors ?? result.payload)}`,
        );
      }
      return oid;
    },
  };

  return api;
};
