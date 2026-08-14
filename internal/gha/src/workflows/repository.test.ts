import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { commands } from "../commands/index.ts";
import { planContractVersion } from "../contract-version.ts";
import {
  BUNDLE,
  dependabotUpdater,
  examplesDir,
  read,
  root,
  scriptsDir,
  usesAction,
  usesReferences,
  workflowsDir,
  yamlFiles,
  yamlStringList,
} from "../testing/workflows.ts";

// `node .github/scripts/gha.mjs <command>` or `node "${SHARED_CLI}" <command>`,
// on one line so the `SHARED_CLI` declaration itself is not mistaken for a call.
const INVOCATION = /(?:gha\.mjs|\$\{SHARED_CLI\})"?[ ]+([a-z-]+)/g;

void test("zizmor is configured to fail the workflow on every finding", () => {
  const source = read(workflowsDir, "shared-zizmor.yml");
  const caller = read(workflowsDir, "repo-zizmor.yml");
  const manifest = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.ok(usesAction(source, "zizmorcore/zizmor-action"));
  assert.match(source, /^ {10}version: "1\.29\.0"$/m);
  assert.match(source, /^ {10}collect: default$/m);
  assert.match(source, /^ {10}online-audits: true$/m);
  assert.match(source, /^ {10}advanced-security: false$/m);
  assert.match(source, /^ {10}annotations: true$/m);
  assert.match(source, /^ {10}fail-on-no-inputs: true$/m);
  assert.ok(!source.includes("security-events:"));
  assert.match(caller, /^ {6}persona: pedantic$/m);
  assert.strictEqual(
    manifest.scripts["lint-actions"],
    "zizmor --strict-collection --collect=default --persona=pedantic .",
  );
});

void test("Dependabot npm cooldowns match pnpm's release-age policy", () => {
  const workspace = readFileSync(`${root}pnpm-workspace.yaml`, "utf8");
  const configuredMinimumReleaseAge = workspace.match(/^minimumReleaseAge: (\d+)$/m)?.[1];
  if (configuredMinimumReleaseAge === undefined) {
    throw new Error("pnpm must explicitly configure minimumReleaseAge");
  }

  const minimumReleaseAgeMinutes = Number(configuredMinimumReleaseAge);
  assert.strictEqual(minimumReleaseAgeMinutes % 1440, 0);
  assert.match(workspace, /^minimumReleaseAgeStrict: true$/m);
  assert.match(workspace, /^minimumReleaseAgeIgnoreMissingTime: false$/m);
  assert.match(workspace, /^trustPolicy: no-downgrade$/m);

  const cooldownDays = minimumReleaseAgeMinutes / 1440;
  const broadExclusions = yamlStringList(workspace, "minimumReleaseAgeExclude", 0).filter(
    (selector) =>
      selector.startsWith("@") ? selector.indexOf("@", 1) < 0 : !selector.includes("@"),
  );
  assert.deepStrictEqual(broadExclusions, ["@zemd/*"]);
  assert.match(workspace, /^ {2}- "@zemd\/\*"$/m);

  for (const [directory, file] of [
    [`${root}.github/`, "dependabot.yml"],
    [examplesDir, "dependabot.yml"],
  ] as const) {
    const npm = dependabotUpdater(read(directory, file), "npm");

    assert.match(
      npm,
      new RegExp(`^ {6}default-days: ${cooldownDays}(?: |$)`, "m"),
      `${file} must match pnpm's minimumReleaseAge`,
    );
    assert.deepStrictEqual(yamlStringList(npm, "exclude", 6), broadExclusions);
  }
});

void test("repository-local secret and editor defaults are hardened", () => {
  const ignored = readFileSync(`${root}.gitignore`, "utf8");
  for (const pattern of [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", ".npmrc"]) {
    assert.match(
      ignored,
      new RegExp(`^${pattern.replaceAll(".", "\\.").replaceAll("*", ".*")}$`, "m"),
    );
  }
  assert.match(ignored, /^!\.env\.example$/m);
  assert.match(ignored, /^!\.env\.\*\.example$/m);

  const devcontainer = JSON.parse(
    readFileSync(`${root}.devcontainer/devcontainer.json`, "utf8"),
  ) as { customizations: { vscode: { extensions: string[] } } };
  for (const extension of devcontainer.customizations.vscode.extensions) {
    assert.match(extension, /^[\w.-]+\.[\w.-]+@\d+\.\d+\.\d+$/);
  }

  const policy = readFileSync(`${root}SECURITY.md`, "utf8");
  assert.ok(policy.includes("within two business days"));
  assert.ok(policy.includes("CVSS v4.0"));
  assert.ok(policy.includes("demonstrably exploitable through a supported package"));
});

void test("every public package requests npm provenance", () => {
  for (const directory of [`${root}packages/`, `${root}http-clients/`]) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = `${directory}${entry.name}/package.json`;
      const manifest = JSON.parse(readFileSync(path, "utf8")) as {
        name?: string;
        private?: boolean;
        publishConfig?: { provenance?: boolean };
      };
      if (manifest.private === true) continue;
      assert.strictEqual(
        manifest.publishConfig?.provenance,
        true,
        `${manifest.name ?? path} must publish with provenance`,
      );
    }
  }
});

void test("Dependabot keeps GitHub Actions behind a seven-day cooldown", () => {
  for (const [directory, file] of [
    [`${root}.github/`, "dependabot.yml"],
    [examplesDir, "dependabot.yml"],
  ] as const) {
    const githubActions = dependabotUpdater(read(directory, file), "github-actions");
    assert.match(githubActions, /^ {6}default-days: 7$/m);
  }
});

void test("examples pin the shared workflows through a replaceable placeholder", () => {
  const examples = yamlFiles(examplesDir);
  const contract = JSON.parse(readFileSync(`${root}internal/gha/package.json`, "utf8")) as {
    name: string;
    version: string;
  };
  const intents = readdirSync(`${root}.changeset/`)
    .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
    .map((file) => ({ id: file, source: readFileSync(`${root}.changeset/${file}`, "utf8") }));
  const plannedVersion = planContractVersion(contract, intents)?.newVersion ?? contract.version;
  const expectedComment = `v${plannedVersion.split(".")[0]}`;
  assert.ok(examples.length > 0);

  for (const file of examples) {
    for (const { reference, comment } of usesReferences(read(examplesDir, file))) {
      assert.match(
        reference,
        /^zemd\/js\/\.github\/workflows\/shared-[a-z]+\.yml@__SHA__$/,
        `${file}: "${reference}" must reference a shared workflow`,
      );
      assert.strictEqual(
        comment,
        expectedComment,
        `${file}: "${reference}" must carry the current contract major comment`,
      );
    }
  }
});

void test("the committed tooling is a single generated bundle", () => {
  assert.deepStrictEqual(readdirSync(scriptsDir), [BUNDLE]);
  assert.match(read(scriptsDir, BUNDLE), /^\/\/ Generated by `pnpm --filter @zemd\/gha run sync`/);
});

void test("every command the workflows invoke is registered in the CLI", () => {
  const invoked = new Set<string>();

  for (const file of yamlFiles(workflowsDir)) {
    for (const [, command] of read(workflowsDir, file).matchAll(INVOCATION)) {
      if (command) invoked.add(command);
    }
  }

  assert.ok(invoked.size > 0);

  for (const command of invoked) {
    assert.ok(
      Object.keys(commands).includes(command),
      `a workflow invokes "${command}", which the CLI does not register`,
    );
  }
});
