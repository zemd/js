import { afterEach, expect, test, vi } from "vitest";

import { apiFromEnv } from "./context";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("uses the REST and GraphQL endpoints provided by GitHub Actions", async () => {
  vi.stubEnv("GITHUB_TOKEN", "secret");
  vi.stubEnv("GITHUB_REPOSITORY", "acme/repo");
  vi.stubEnv("GITHUB_API_URL", "https://github.example.com/api/v3");
  vi.stubEnv("GITHUB_GRAPHQL_URL", "https://github.example.com/api/graphql");

  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }));
  vi.stubGlobal("fetch", fetch);

  const api = apiFromEnv();
  await api.request("/user", "GET");
  await api.graphql("query { viewer { login } }", {});

  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "https://github.example.com/api/v3/user",
    "https://github.example.com/api/graphql",
  ]);
});
