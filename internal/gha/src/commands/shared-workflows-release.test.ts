import assert from "node:assert/strict";
import { test } from "node:test";
import { stubEnvironment } from "@zemd/testing";

import { sharedWorkflowsRelease } from "./shared-workflows-release.ts";

void test("reports whether the contract version still needs a GitHub release", async (context) => {
  stubEnvironment(context, {
    GITHUB_TOKEN: "secret",
    GITHUB_REPOSITORY: "acme/repo",
  });

  const fetch = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{}", { status: 200 }),
  );
  let output = "";
  context.mock.method(process.stdout, "write", (chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  });

  await sharedWorkflowsRelease.run(["pending", "1.2.3"]);

  assert.strictEqual(output, "pending=false\n");
  assert.strictEqual(fetch.mock.calls.length, 1);
  assert.strictEqual(
    fetch.mock.calls[0]?.arguments[0],
    "https://api.github.com/repos/acme/repo/releases/tags/v1.2.3",
  );
});

void test("fails closed when the exact GitHub release lookup fails", async (context) => {
  stubEnvironment(context, {
    GITHUB_TOKEN: "secret",
    GITHUB_REPOSITORY: "acme/repo",
  });
  context.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 503 }));

  await assert.rejects(
    Promise.resolve().then(() => sharedWorkflowsRelease.run(["pending", "1.2.3"])),
    /GitHub returned 503/,
  );
});
