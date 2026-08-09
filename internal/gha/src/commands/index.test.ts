import { expect, test } from "vitest";

import { commands, usage } from "./index";

test("exposes every release step the shared workflows need", () => {
  expect(Object.keys(commands).sort()).toEqual([
    "contract-version",
    "github-releases",
    "npm-publishing-mode",
    "release-pr-body",
    "shared-workflows-release",
    "signed-commit",
  ]);
});

test("lists every command with its arguments in the usage text", () => {
  const text = usage();

  expect(text).toContain("usage: gha.mjs <command> [args]");
  for (const [name, command] of Object.entries(commands)) {
    expect(text).toContain(`  ${name} ${command.usage}`);
  }
});

test("rejects a command invoked without its arguments", async () => {
  for (const [name, command] of Object.entries(commands)) {
    await expect(
      async () => command.run([]),
      `${name} must reject an empty argument list`,
    ).rejects.toThrow(new RegExp(`usage: ${name}`));
  }
});
