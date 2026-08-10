import assert from "node:assert/strict";
import { test } from "node:test";
import { stubEnvironment } from "@zemd/testing";

import { apiFromEnv } from "./context.ts";

void test("uses the REST and GraphQL endpoints provided by GitHub Actions", async (context) => {
  stubEnvironment(context, {
    GITHUB_TOKEN: "secret",
    GITHUB_REPOSITORY: "acme/repo",
    GITHUB_API_URL: "https://github.example.com/api/v3",
    GITHUB_GRAPHQL_URL: "https://github.example.com/api/graphql",
  });

  const fetch = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );

  const api = apiFromEnv();
  await api.request("/user", "GET");
  await api.graphql("query { viewer { login } }", {});

  assert.deepStrictEqual(
    fetch.mock.calls.map((call) => call.arguments[0]),
    ["https://github.example.com/api/v3/user", "https://github.example.com/api/graphql"],
  );
});
