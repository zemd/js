import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { stubEnvironment } from "@zemd/testing";

import { releasePrArtifact } from "./release-pr-artifact.ts";

void test("lets collectChanges reject git status output larger than Node's default buffer", (context) => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "gha-release-pr-artifact-command-")));
  context.after(() => rmSync(directory, { force: true, recursive: true }));

  const bin = join(directory, "bin");
  const artifact = join(directory, "artifact");
  const body = join(directory, "body.md");
  const workspace = join(directory, "workspace.json");
  mkdirSync(bin);
  mkdirSync(artifact);
  writeFileSync(body, "Release body\n");
  writeFileSync(
    workspace,
    JSON.stringify([{ name: "workspace", version: "1.0.0", path: process.cwd() }]),
  );

  const git = join(bin, "git");
  writeFileSync(
    git,
    `#!${process.execPath}\nconst prefix = "packages/" + "a".repeat(4083);\nprocess.stdout.write(Array.from({ length: 1001 }, (_, index) => \`?? \${prefix}\${String(index).padStart(4, "0")}\\0\`).join(""));\n`,
  );
  chmodSync(git, 0o755);
  stubEnvironment(context, { PATH: `${bin}${delimiter}${process.env["PATH"] ?? ""}` });

  assert.throws(
    () => releasePrArtifact.run([workspace, body, artifact]),
    /release contains more than 1000 files/,
  );
});
