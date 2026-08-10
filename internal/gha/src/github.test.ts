import assert from "node:assert/strict";
import { mock, test, type Mock } from "node:test";

import { createGitHubApi } from "./github.ts";

const okResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const fetchReturning = (response: Response): Mock<typeof globalThis.fetch> =>
  mock.fn<typeof globalThis.fetch>(async () => response);

void test("authenticates and versions every REST call", async () => {
  const fetch = fetchReturning(okResponse({ ok: true }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.request("/repos/acme/repo/releases", "POST", { tag_name: "v1" });

  const [url, init] = fetch.mock.calls[0]?.arguments ?? [];
  assert.strictEqual(url, "https://api.github.com/repos/acme/repo/releases");
  assert.strictEqual(init?.method, "POST");
  assert.strictEqual(init?.body, JSON.stringify({ tag_name: "v1" }));
  assert.partialDeepStrictEqual(init?.headers, {
    authorization: "Bearer secret",
    "x-github-api-version": "2022-11-28",
  });
});

void test("uses GitHub.com's GraphQL endpoint by default", async () => {
  const fetch = fetchReturning(okResponse({}));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.graphql("query { viewer { login } }", {});

  assert.strictEqual(fetch.mock.calls[0]?.arguments[0], "https://api.github.com/graphql");
});

void test("uses the configured GraphQL endpoint independently of the REST endpoint", async () => {
  const fetch = fetchReturning(okResponse({}));
  const api = createGitHubApi({
    token: "secret",
    repository: "acme/repo",
    apiUrl: "https://github.example.com/api/v3",
    graphqlUrl: "https://github.example.com/api/graphql",
    fetch,
  });

  await api.graphql("query { viewer { login } }", {});

  assert.strictEqual(fetch.mock.calls[0]?.arguments[0], "https://github.example.com/api/graphql");
});

void test("omits a body for GET requests", async () => {
  const fetch = fetchReturning(okResponse({}));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.tagExists("v1.0.0");

  assert.ok(!Object.hasOwn(fetch.mock.calls[0]?.arguments[1] ?? {}, "body"));
});

void test("escapes tags when checking whether they exist", async () => {
  const fetch = fetchReturning(okResponse({}));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await api.tagExists("@acme/pkg@1.0.0");

  assert.strictEqual(
    fetch.mock.calls[0]?.arguments[0],
    "https://api.github.com/repos/acme/repo/git/ref/tags/%40acme%2Fpkg%401.0.0",
  );
});

void test("only treats a 404 as a missing tag", async () => {
  const missingFetch = fetchReturning(new Response("{}", { status: 404 }));
  const missingApi = createGitHubApi({
    token: "secret",
    repository: "acme/repo",
    fetch: missingFetch,
  });

  assert.strictEqual(await missingApi.tagExists("@acme/pkg@1.0.0"), false);

  const failedFetch = fetchReturning(new Response("{}", { status: 503 }));
  const failedApi = createGitHubApi({
    token: "secret",
    repository: "acme/repo",
    fetch: failedFetch,
  });

  await assert.rejects(failedApi.tagExists("@acme/pkg@1.0.0"), /GitHub returned 503/);
});

void test("tolerates an empty response body", async () => {
  const fetch = fetchReturning(new Response(null, { status: 204 }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  const response = await api.request("/anything", "GET");

  assert.strictEqual(response.ok, true);
  assert.deepStrictEqual(response.payload, {});
});

void test("returns no releases when the listing fails", async () => {
  const fetch = fetchReturning(new Response("{}", { status: 500 }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  assert.deepStrictEqual(await api.listReleases(), []);
});

void test("falls back to empty notes when generation fails", async () => {
  const fetch = fetchReturning(new Response("{}", { status: 422 }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  assert.strictEqual(await api.generateNotes("v1", "sha", ""), "");
});

void test("surfaces GraphQL errors when creating a commit", async () => {
  const fetch = fetchReturning(okResponse({ errors: [{ message: "branch is protected" }] }));
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  await assert.rejects(
    api.createCommitOnBranch("release/main", "abc", "chore: release", {
      additions: [],
      deletions: [],
    }),
    /branch is protected/,
  );
});

void test("splits a commit message into headline and body", async () => {
  const fetch = fetchReturning(
    okResponse({ data: { createCommitOnBranch: { commit: { oid: "def" } } } }),
  );
  const api = createGitHubApi({ token: "secret", repository: "acme/repo", fetch });

  const oid = await api.createCommitOnBranch("release/main", "abc", "headline\n\nthe body", {
    additions: [],
    deletions: [],
  });

  assert.strictEqual(oid, "def");
  const requestBody = fetch.mock.calls[0]?.arguments[1]?.body;
  if (typeof requestBody !== "string") {
    throw new Error("expected a serialised request body");
  }
  const body = JSON.parse(requestBody) as {
    variables: { input: { message: { headline: string; body?: string } } };
  };
  assert.deepStrictEqual(body.variables.input.message, { headline: "headline", body: "the body" });
});
