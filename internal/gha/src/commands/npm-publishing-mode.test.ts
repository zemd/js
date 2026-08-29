import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { stubEnvironment } from "@zemd/testing";

import { npmPublishingMode } from "./npm-publishing-mode.ts";

const run = async (
  context: TestContext,
  tagExists: boolean,
): Promise<{ readonly output: string; readonly requests: readonly string[] }> => {
  const directory = mkdtempSync(join(tmpdir(), "npm-publishing-mode-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const workspace = join(directory, "workspace.json");
  const firstReleases = join(directory, "first-releases.txt");
  const directPackages = join(directory, "direct-packages.txt");
  const stagedPackages = join(directory, "staged-packages.txt");
  writeFileSync(
    workspace,
    JSON.stringify([
      {
        name: "@acme/example",
        version: "1.2.3",
        path: join(directory, "package"),
        private: false,
      },
    ]),
  );
  stubEnvironment(context, {
    GITHUB_TOKEN: "secret",
    GITHUB_REPOSITORY: "acme/repo",
  });

  const requests: string[] = [];
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push(url);
    if (url.startsWith("https://api.github.com/")) {
      return new Response("{}", { status: tagExists ? 200 : 404 });
    }
    return new Response("{}", { status: 200 });
  });

  let output = "";
  context.mock.method(process.stdout, "write", (chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  });

  await npmPublishingMode.run([
    workspace,
    "https://registry.npmjs.org",
    "true",
    firstReleases,
    directPackages,
    stagedPackages,
  ]);

  assert.strictEqual(readFileSync(firstReleases, "utf8"), "");
  assert.strictEqual(readFileSync(directPackages, "utf8"), "");
  return { output, requests };
};

void test("reports that an already tagged package release is not pending", async (context) => {
  const { output, requests } = await run(context, true);

  assert.ok(output.includes("mode=none\n"));
  assert.ok(output.includes("pending=false\n"));
  assert.ok(output.includes("stage=false\n"));
  assert.strictEqual(requests.length, 1);
});

void test("reports that an untagged package release is pending", async (context) => {
  const { output, requests } = await run(context, false);

  assert.ok(output.includes("mode=staged\n"));
  assert.ok(output.includes("pending=true\n"));
  assert.ok(output.includes("stage=true\n"));
  assert.strictEqual(requests.length, 2);
});
