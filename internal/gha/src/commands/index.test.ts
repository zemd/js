import assert from "node:assert/strict";
import { test } from "node:test";

import { commands, usage } from "./index.ts";

void test("exposes every release step the shared workflows need", () => {
  assert.deepStrictEqual(Object.keys(commands).sort(), [
    "contract-version",
    "github-releases",
    "npm-publishing-mode",
    "release-pr-body",
    "shared-workflows-release",
    "signed-commit",
  ]);
});

void test("lists every command with its arguments in the usage text", () => {
  const text = usage();

  assert.ok(text.includes("usage: gha.mjs <command> [args]"));
  for (const [name, command] of Object.entries(commands)) {
    assert.ok(text.includes(`  ${name} ${command.usage}`));
  }
});

void test("rejects a command invoked without its arguments", async () => {
  for (const [name, command] of Object.entries(commands)) {
    await assert.rejects(
      Promise.resolve().then(() => command.run([])),
      new RegExp(`usage: ${name}`),
      `${name} must reject an empty argument list`,
    );
  }
});
