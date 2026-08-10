import assert from "node:assert/strict";
import { test, mock } from "node:test";

import { packageExistsOnRegistry, planNpmPublishing } from "./npm-publishing.ts";
import type { WorkspacePackage } from "./pnpm.ts";

const workspacePackage = (
  name: string,
  isPrivate = false,
  version = "1.0.0",
): WorkspacePackage => ({
  name,
  version,
  path: `/workspace/${name}`,
  private: isPrivate,
});

void test("uses staged publishing when every public package exists", async () => {
  const packageExists = mock.fn(async () => true);

  assert.deepStrictEqual(
    await planNpmPublishing(
      [workspacePackage("public"), workspacePackage("internal", true)],
      true,
      packageExists,
      async () => false,
    ),
    {
      mode: "staged",
      directPackages: [],
      firstReleasePackages: [],
      previouslySubmittedPackages: [],
      stagedPackages: ["public"],
    },
  );
  assert.deepStrictEqual(
    packageExists.mock.calls.map((call) => call.arguments),
    [["public"]],
  );
});

void test("uses direct publishing when any public package needs its first release", async () => {
  const packageExists = mock.fn(async (name: string) => name !== "@scope/new-package");

  assert.deepStrictEqual(
    await planNpmPublishing(
      [workspacePackage("existing"), workspacePackage("@scope/new-package")],
      true,
      packageExists,
      async () => false,
    ),
    {
      mode: "mixed",
      directPackages: ["@scope/new-package"],
      firstReleasePackages: ["@scope/new-package"],
      previouslySubmittedPackages: [],
      stagedPackages: ["existing"],
    },
  );
});

void test("checks whether regular publishing needs a token when it was requested explicitly", async () => {
  const packageExists = mock.fn(async () => false);

  assert.deepStrictEqual(
    await planNpmPublishing([workspacePackage("public")], false, packageExists, async () => false),
    {
      mode: "direct",
      directPackages: ["public"],
      firstReleasePackages: ["public"],
      previouslySubmittedPackages: [],
      stagedPackages: [],
    },
  );
  assert.deepStrictEqual(
    packageExists.mock.calls.map((call) => call.arguments),
    [["public"]],
  );
});

void test("encodes scoped names when checking the registry", async () => {
  const request = mock.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
  }));

  assert.strictEqual(
    await packageExistsOnRegistry("@scope/package", "https://registry.example.test/npm", request),
    true,
  );
  assert.deepStrictEqual(
    request.mock.calls.map((call) => call.arguments),
    [
      [
        new URL("https://registry.example.test/npm/@scope%2Fpackage"),
        { headers: { accept: "application/vnd.npm.install-v1+json" } },
      ],
    ],
  );
});

void test("only treats a registry 404 as a missing package", async () => {
  assert.strictEqual(
    await packageExistsOnRegistry("new-package", "https://registry.example.test", async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
    })),
    false,
  );

  await assert.rejects(
    packageExistsOnRegistry("existing", "https://registry.example.test", async () => ({
      ok: false,
      status: 503,
      statusText: "Unavailable",
    })),
    /npm registry lookup for "existing" failed: 503 Unavailable/,
  );
});

void test("uses direct publishing for existing packages when staging is disabled", async () => {
  const packageExists = mock.fn(async () => true);

  assert.deepStrictEqual(
    await planNpmPublishing([workspacePackage("public")], false, packageExists, async () => false),
    {
      mode: "direct",
      directPackages: ["public"],
      firstReleasePackages: [],
      previouslySubmittedPackages: [],
      stagedPackages: [],
    },
  );
});

void test("never resubmits a tagged version after staged approval is rejected", async () => {
  const packageExists = mock.fn(async () => true);
  const releaseTagExists = mock.fn(async (tag: string) => tag === "@scope/package@2.0.0");

  assert.deepStrictEqual(
    await planNpmPublishing(
      [workspacePackage("@scope/package", false, "2.0.0")],
      true,
      packageExists,
      releaseTagExists,
    ),
    {
      mode: "none",
      directPackages: [],
      firstReleasePackages: [],
      previouslySubmittedPackages: [{ name: "@scope/package", version: "2.0.0" }],
      stagedPackages: [],
    },
  );
  assert.strictEqual(packageExists.mock.callCount(), 0);

  assert.deepStrictEqual(
    await planNpmPublishing(
      [workspacePackage("@scope/package", false, "2.0.1")],
      true,
      packageExists,
      releaseTagExists,
    ),
    {
      mode: "staged",
      directPackages: [],
      firstReleasePackages: [],
      previouslySubmittedPackages: [],
      stagedPackages: ["@scope/package"],
    },
  );
  assert.deepStrictEqual(
    packageExists.mock.calls.map((call) => call.arguments),
    [["@scope/package"]],
  );
});
