import { expect, test, vi } from "vitest";

import { createGitHubApi } from "./github";

const okResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

test("authenticates and versions every REST call", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse({ ok: true }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.request("/repos/acme/repo/releases", "POST", { tag_name: "v1" });

  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(url).toBe("https://api.github.com/repos/acme/repo/releases");
  expect(init?.method).toBe("POST");
  expect(init?.body).toBe(JSON.stringify({ tag_name: "v1" }));
  expect(init?.headers).toMatchObject({
    authorization: "Bearer secret",
    "x-github-api-version": "2022-11-28",
  });
});

test("uses GitHub.com's GraphQL endpoint by default", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse({}));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.graphql("query { viewer { login } }", {});

  expect(fetch.mock.calls[0]?.[0]).toBe("https://api.github.com/graphql");
});

test("uses the configured GraphQL endpoint independently of the REST endpoint", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse({}));
  const api = createGitHubApi({
    token: "secret",
    repository: "acme/repo",
    apiUrl: "https://github.example.com/api/v3",
    graphqlUrl: "https://github.example.com/api/graphql",
    fetch,
  });

  await api.graphql("query { viewer { login } }", {});

  expect(fetch.mock.calls[0]?.[0]).toBe("https://github.example.com/api/graphql");
});

test("omits a body for GET requests", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse({}));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.tagExists("v1.0.0");

  expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty("body");
});

test("escapes tags when checking whether they exist", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse({}));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.tagExists("@acme/pkg@1.0.0");

  expect(fetch.mock.calls[0]?.[0]).toBe(
    "https://api.github.com/repos/acme/repo/git/ref/tags/%40acme%2Fpkg%401.0.0",
  );
});

test("only treats a 404 as a missing tag", async () => {
  const missingFetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response("{}", { status: 404 }));
  const missingApi = createGitHubApi({
    token: "secret",
    repository: "acme/repo",
    fetch: missingFetch,
  });

  await expect(missingApi.tagExists("@acme/pkg@1.0.0")).resolves.toBe(false);

  const failedFetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response("{}", { status: 503 }));
  const failedApi = createGitHubApi({
    token: "secret",
    repository: "acme/repo",
    fetch: failedFetch,
  });

  await expect(failedApi.tagExists("@acme/pkg@1.0.0")).rejects.toThrow(/GitHub returned 503/);
});

test("tolerates an empty response body", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  const response = await api.request("/anything", "GET");

  expect(response.ok).toBe(true);
  expect(response.payload).toEqual({});
});

test("returns no releases when the listing fails", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response("{}", { status: 500 }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  expect(await api.listReleases()).toEqual([]);
});

test("falls back to empty notes when generation fails", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response("{}", { status: 422 }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  expect(await api.generateNotes("v1", "sha", "")).toBe("");
});

test("surfaces GraphQL errors when creating a commit", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(okResponse({ errors: [{ message: "branch is protected" }] }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await expect(
    api.createCommitOnBranch("release/main", "abc", "chore: release", {
      additions: [],
      deletions: [],
    }),
  ).rejects.toThrow(/branch is protected/);
});

test("splits a commit message into headline and body", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(okResponse({ data: { createCommitOnBranch: { commit: { oid: "def" } } } }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  const oid = await api.createCommitOnBranch("release/main", "abc", "headline\n\nthe body", {
    additions: [],
    deletions: [],
  });

  expect(oid).toBe("def");
  const requestBody = fetch.mock.calls[0]?.[1]?.body;
  if (typeof requestBody !== "string") {
    throw new Error("expected a serialised request body");
  }
  const body = JSON.parse(requestBody) as {
    variables: { input: { message: { headline: string; body?: string } } };
  };
  expect(body.variables.input.message).toEqual({ headline: "headline", body: "the body" });
});
