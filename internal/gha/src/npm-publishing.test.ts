import { expect, test, vi } from "vitest";

import { packageExistsOnRegistry, planNpmPublishing } from "./npm-publishing";
import type { WorkspacePackage } from "./pnpm";

const workspacePackage = (name: string, isPrivate = false): WorkspacePackage => ({
  name,
  version: "1.0.0",
  path: `/workspace/${name}`,
  private: isPrivate,
});

test("uses staged publishing when every public package exists", async () => {
  const packageExists = vi.fn(async () => true);

  await expect(
    planNpmPublishing(
      [workspacePackage("public"), workspacePackage("internal", true)],
      true,
      packageExists,
    ),
  ).resolves.toEqual({
    mode: "staged",
    firstReleasePackages: [],
    stagedPackages: ["public"],
  });
  expect(packageExists).toHaveBeenCalledExactlyOnceWith("public");
});

test("uses direct publishing when any public package needs its first release", async () => {
  const packageExists = vi.fn(async (name: string) => name !== "@scope/new-package");

  await expect(
    planNpmPublishing(
      [workspacePackage("existing"), workspacePackage("@scope/new-package")],
      true,
      packageExists,
    ),
  ).resolves.toEqual({
    mode: "mixed",
    firstReleasePackages: ["@scope/new-package"],
    stagedPackages: ["existing"],
  });
});

test("checks whether regular publishing needs a token when it was requested explicitly", async () => {
  const packageExists = vi.fn(async () => false);

  await expect(
    planNpmPublishing([workspacePackage("public")], false, packageExists),
  ).resolves.toEqual({
    mode: "direct",
    firstReleasePackages: ["public"],
    stagedPackages: [],
  });
  expect(packageExists).toHaveBeenCalledExactlyOnceWith("public");
});

test("encodes scoped names when checking the registry", async () => {
  const request = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" }));

  await expect(
    packageExistsOnRegistry("@scope/package", "https://registry.example.test/npm", request),
  ).resolves.toBe(true);
  expect(request).toHaveBeenCalledExactlyOnceWith(
    new URL("https://registry.example.test/npm/@scope%2Fpackage"),
    { headers: { accept: "application/vnd.npm.install-v1+json" } },
  );
});

test("only treats a registry 404 as a missing package", async () => {
  await expect(
    packageExistsOnRegistry("new-package", "https://registry.example.test", async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
    })),
  ).resolves.toBe(false);

  await expect(
    packageExistsOnRegistry("existing", "https://registry.example.test", async () => ({
      ok: false,
      status: 503,
      statusText: "Unavailable",
    })),
  ).rejects.toThrow('npm registry lookup for "existing" failed: 503 Unavailable');
});
